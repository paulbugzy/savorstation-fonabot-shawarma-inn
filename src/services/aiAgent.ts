import OpenAI from 'openai';
import env from '@/config/env';
import logger from '@/utils/logger';
import laravelClient from './laravelClient';
import branchDetection from './branchDetection';
import { CallSession, OrderType, PosPaymentMethod, BranchId } from '@/types';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a friendly and professional voice assistant for SavorStation restaurant, helping customers place orders over the phone.

Your responsibilities:
1. Greet the customer warmly
2. Determine order type: DELIVERY, PICKUP, or DINE-IN
3. For PICKUP or DINE-IN: Ask which location (Chicago or Park Ridge)
4. For DELIVERY: Collect full address to detect service area
5. Collect customer information (name, phone, email optional)
6. Help them select menu items with required modifiers
7. Offer extras and collect special instructions
8. Ask about tips
9. Collect payment information (cash, card last 4 digits, or mobile transaction ref)
10. Confirm the order and provide total
11. Create the order and read back the order number

Important rules:
- Always be polite and patient
- For pickup/dine-in, MUST collect location before showing menu
- For delivery, MUST verify address is in service area
- Ensure all required modifiers are selected for each item
- Never store full card numbers, only last 4 digits
- Keep conversation natural and conversational
- Confirm order details before submitting

Available tools:
- searchCustomer: Find existing customer by phone/email
- createCustomer: Create new customer profile
- createAddress: Add delivery address
- getMenu: Fetch menu for specific branch
- getVariations: Get modifiers for menu item
- detectBranch: Find branch for delivery address
- createOrder: Submit final order

Remember: You're on a phone call, so keep responses concise and clear.`;

export class AIAgent {
  async processUserInput(
    session: CallSession,
    userMessage: string
  ): Promise<{ response: string; updates: any[] }> {
    const messages = this.buildMessages(session, userMessage);

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: this.getTools(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500,
      });

      const choice = completion.choices[0];
      const updates: any[] = [];

      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          const result = await this.executeToolCall(toolCall, session);
          updates.push(result);
        }

        const followUpCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            ...messages,
            choice.message,
            ...choice.message.tool_calls.map((tc, idx) => ({
              role: 'tool' as const,
              tool_call_id: tc.id,
              content: JSON.stringify(updates[idx]),
            })),
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        return {
          response: followUpCompletion.choices[0].message.content || 'Let me help you with that.',
          updates,
        };
      }

      return {
        response: choice.message.content || 'I understand. How can I help you further?',
        updates,
      };
    } catch (error) {
      logger.error({ error }, 'OpenAI API error');
      return {
        response: 'I apologize, I\'m having trouble processing that. Could you please repeat?',
        updates: [],
      };
    }
  }

  private buildMessages(session: CallSession, userMessage: string): any[] {
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    messages.push(
      ...session.conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
    );

    const context = this.buildContextString(session);
    if (context) {
      messages.push({
        role: 'system',
        content: `Current order context:\n${context}`,
      });
    }

    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  private buildContextString(session: CallSession): string {
    const parts: string[] = [];

    if (session.orderType) {
      const typeNames: Record<number, string> = {
        [OrderType.DELIVERY]: 'Delivery',
        [OrderType.TAKEAWAY]: 'Pickup',
        [OrderType.DINING_TABLE]: 'Dine-In',
      };
      parts.push(`Order Type: ${typeNames[session.orderType]}`);
    }

    if (session.branchId) {
      const branchNames: Record<number, string> = {
        [BranchId.CHICAGO]: 'Chicago',
        [BranchId.PARK_RIDGE]: 'Park Ridge',
      };
      parts.push(`Location: ${branchNames[session.branchId]}`);
    }

    if (session.customerId) {
      parts.push(`Customer ID: ${session.customerId}`);
    }

    if (session.items.length > 0) {
      parts.push(`Items in cart: ${session.items.length}`);
      parts.push(`Current total: $${session.total.toFixed(2)}`);
    }

    return parts.join('\n');
  }

  private getTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'searchCustomer',
          description: 'Search for existing customer by phone number or email',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Phone number or email to search',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'createCustomer',
          description: 'Create a new customer profile',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Customer full name' },
              phone: { type: 'string', description: 'Customer phone number' },
              email: { type: 'string', description: 'Customer email (optional)' },
              branchId: { type: 'number', description: 'Branch ID' },
            },
            required: ['name', 'phone', 'branchId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'createAddress',
          description: 'Add delivery address for customer',
          parameters: {
            type: 'object',
            properties: {
              customerId: { type: 'number', description: 'Customer ID' },
              line1: { type: 'string', description: 'Street address' },
              city: { type: 'string', description: 'City' },
              state: { type: 'string', description: 'State' },
              zip: { type: 'string', description: 'Zip code' },
            },
            required: ['customerId', 'line1', 'city', 'state', 'zip'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getMenu',
          description: 'Get menu items for a specific branch',
          parameters: {
            type: 'object',
            properties: {
              branchId: { type: 'number', description: 'Branch ID (1=Chicago, 2=Park Ridge)' },
            },
            required: ['branchId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getVariations',
          description: 'Get available modifiers/variations for a menu item',
          parameters: {
            type: 'object',
            properties: {
              itemId: { type: 'number', description: 'Menu item ID' },
            },
            required: ['itemId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'detectBranch',
          description: 'Detect branch for delivery address',
          parameters: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'Full delivery address',
              },
            },
            required: ['address'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'setOrderType',
          description: 'Set the order type (delivery, pickup, or dine-in)',
          parameters: {
            type: 'object',
            properties: {
              orderType: {
                type: 'string',
                enum: ['delivery', 'pickup', 'dine-in'],
                description: 'Type of order',
              },
            },
            required: ['orderType'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'setBranch',
          description: 'Set branch location for pickup or dine-in',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                enum: ['chicago', 'park ridge'],
                description: 'Branch location',
              },
            },
            required: ['location'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'addItem',
          description: 'Add a fully configured menu item to the current order. Only call after gathering required modifiers and pricing.',
          parameters: {
            type: 'object',
            properties: {
              item: {
                type: 'object',
                description: 'Item payload matching the POS schema',
                properties: {
                  item_id: { type: 'number', description: 'Menu item ID from POS' },
                  quantity: { type: 'number', minimum: 1, description: 'Item quantity' },
                  item_price: { type: 'number', description: 'Base price for one unit (before modifiers/extras)' },
                  discount: { type: 'number', description: 'Discount amount applied to the item, in USD' },
                  instruction: { type: 'string', description: 'Optional preparation notes for the kitchen' },
                  item_variations: {
                    type: 'array',
                    description: 'Selected modifier choices',
                    items: {
                      type: 'object',
                      properties: {
                        attribute_id: { type: 'number', description: 'Attribute/option group ID' },
                        attribute_name: { type: 'string', description: 'Attribute/option group name' },
                        variation_id: { type: 'number', description: 'Selected variation ID' },
                        variation_name: { type: 'string', description: 'Selected variation name' },
                        extra_price: { type: 'number', description: 'Additional price for this variation' },
                      },
                      required: ['attribute_id', 'variation_id', 'variation_name', 'extra_price'],
                    },
                  },
                  item_extras: {
                    type: 'array',
                    description: 'Selected add-ons/extras',
                    items: {
                      type: 'object',
                      properties: {
                        extra_id: { type: 'number', description: 'Extra item ID' },
                        extra_name: { type: 'string', description: 'Extra item name' },
                        qty: { type: 'number', description: 'Quantity of this extra' },
                        price: { type: 'number', description: 'Price per extra unit' },
                      },
                      required: ['extra_id', 'extra_name', 'qty', 'price'],
                    },
                  },
                },
                required: ['item_id', 'quantity', 'item_price'],
              },
            },
            required: ['item'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'removeItem',
          description: 'Remove an item from the order by its index in the current cart (0-based).',
          parameters: {
            type: 'object',
            properties: {
              index: { type: 'number', description: '0-based index of the item in the order items array' },
            },
            required: ['index'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'updateItem',
          description: 'Update a previously added item by index. Only include the fields that should be changed.',
          parameters: {
            type: 'object',
            properties: {
              index: { type: 'number', description: '0-based index of the item in the order items array' },
              item: {
                type: 'object',
                description: 'Partial item payload with fields to update',
                properties: {
                  quantity: { type: 'number', description: 'Updated quantity' },
                  discount: { type: 'number', description: 'Updated discount amount' },
                  instruction: { type: 'string', description: 'Updated preparation notes' },
                  item_variations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        attribute_id: { type: 'number' },
                        attribute_name: { type: 'string' },
                        variation_id: { type: 'number' },
                        variation_name: { type: 'string' },
                        extra_price: { type: 'number' },
                      },
                      required: ['attribute_id', 'variation_id', 'variation_name', 'extra_price'],
                    },
                  },
                  item_extras: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        extra_id: { type: 'number' },
                        extra_name: { type: 'string' },
                        qty: { type: 'number' },
                        price: { type: 'number' },
                      },
                      required: ['extra_id', 'extra_name', 'qty', 'price'],
                    },
                  },
                },
              },
            },
            required: ['index', 'item'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'setPayment',
          description: 'Capture the payment method and any supporting details (cash, card last 4, mobile transaction reference, etc.).',
          parameters: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['cash', 'card', 'mobile', 'other'],
                description: 'Payment method selected by the guest',
              },
              note: {
                type: 'string',
                description: 'Optional note such as card last four digits or transaction reference',
              },
              amount: {
                type: 'number',
                description: 'Amount collected when applicable (cash received, etc.)',
              },
            },
            required: ['method'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'setTip',
          description: 'Set the tip amount (USD) that should be applied to the order total.',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Tip amount in USD' },
            },
            required: ['amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'setDeliveryCharge',
          description: 'Set the delivery charge (USD) for the order when applicable.',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Delivery charge in USD' },
            },
            required: ['amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'setDiscount',
          description: 'Apply a discount amount (USD) to the order total.',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Discount amount in USD' },
            },
            required: ['amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'setDeliveryTime',
          description: 'Set the requested delivery or pickup time.',
          parameters: {
            type: 'object',
            properties: {
              time: {
                type: 'string',
                description: 'Requested delivery/pickup time in ISO 8601 or natural language (e.g., "today at 6:30 PM")',
              },
            },
            required: ['time'],
          },
        },
      },
    ];
  }

  private async executeToolCall(toolCall: any, session: CallSession): Promise<any> {
    const { name, arguments: argsStr } = toolCall.function;
    const args = JSON.parse(argsStr);

    logger.info({ name, args }, 'Executing tool call');

    try {
      switch (name) {
        case 'searchCustomer':
          return await laravelClient.searchCustomer(args.query);

        case 'createCustomer':
          const customer = await laravelClient.createCustomer({
            name: args.name,
            phone: args.phone,
            email: args.email,
            branch_id: args.branchId,
          });
          return { success: true, customerId: customer.id, customer };

        case 'createAddress':
          const address = await laravelClient.createAddress(args.customerId, {
            line1: args.line1,
            city: args.city,
            state: args.state,
            zip: args.zip,
          });
          return { success: true, addressId: address.id, address };

        case 'getMenu':
          return await laravelClient.getMenu(args.branchId);

        case 'getVariations':
          return await laravelClient.getVariations(args.itemId);

        case 'detectBranch':
          const branch = await branchDetection.detectBranchForDelivery(args.address);
          return {
            success: true,
            branchId: branch.id,
            branchName: branch.name,
            reducerUpdate: {
              type: 'SET_BRANCH',
              payload: branch.id,
            },
          };

        case 'setOrderType':
          const orderTypeMap: { [key: string]: OrderType } = {
            delivery: OrderType.DELIVERY,
            pickup: OrderType.TAKEAWAY,
            'dine-in': OrderType.DINING_TABLE,
          };
          if (!orderTypeMap[args.orderType]) {
            throw new Error(`Unsupported order type: ${args.orderType}`);
          }
          return {
            success: true,
            orderType: orderTypeMap[args.orderType],
            reducerUpdate: {
              type: 'SET_ORDER_TYPE',
              payload: orderTypeMap[args.orderType],
            },
          };

        case 'setBranch':
          const branchMap: { [key: string]: BranchId } = {
            chicago: BranchId.CHICAGO,
            'park ridge': BranchId.PARK_RIDGE,
          };
          if (!branchMap[args.location]) {
            throw new Error(`Unsupported branch: ${args.location}`);
          }
          return {
            success: true,
            branchId: branchMap[args.location],
            reducerUpdate: {
              type: 'SET_BRANCH',
              payload: branchMap[args.location],
            },
          };

        case 'addItem':
          if (!session.branchId) {
            throw new Error('Branch must be selected before adding items.');
          }
          if (!args.item || args.item.item_id === undefined || args.item.item_price === undefined) {
            throw new Error('Item payload must include item_id and item_price.');
          }

          const itemId = Number(args.item.item_id);
          const quantity = Number(args.item.quantity ?? 1);
          const itemPrice = Number(args.item.item_price);
          const discount = Number(args.item.discount ?? 0);

          if (!Number.isFinite(itemId) || !Number.isFinite(itemPrice)) {
            throw new Error('Item ID and item price must be numeric.');
          }

          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('Quantity must be a positive number.');
          }

          if (!Number.isFinite(discount) || discount < 0) {
            throw new Error('Discount must be zero or a positive number.');
          }

          return {
            success: true,
            itemId: args.item.item_id,
            reducerUpdate: {
              type: 'ADD_ITEM',
              payload: {
                item_id: itemId,
                quantity,
                item_price: itemPrice,
                discount,
                instruction: args.item.instruction,
                item_variations: (args.item.item_variations || []).map((variation: any) => ({
                  attribute_id: Number(variation.attribute_id),
                  attribute_name: variation.attribute_name,
                  variation_id: Number(variation.variation_id),
                  variation_name: variation.variation_name,
                  extra_price: Number(variation.extra_price ?? 0),
                })),
                item_extras: (args.item.item_extras || []).map((extra: any) => ({
                  extra_id: Number(extra.extra_id),
                  extra_name: extra.extra_name,
                  qty: Number(extra.qty ?? 1),
                  price: Number(extra.price ?? 0),
                })),
              },
            },
          };

        case 'removeItem':
          const removeIndex = Number(args.index);

          if (!Number.isInteger(removeIndex) || removeIndex < 0) {
            throw new Error('Index must be a non-negative integer.');
          }

          return {
            success: true,
            index: removeIndex,
            reducerUpdate: {
              type: 'REMOVE_ITEM',
              payload: removeIndex,
            },
          };

        case 'updateItem':
          const updateIndex = Number(args.index);

          if (!Number.isInteger(updateIndex) || updateIndex < 0) {
            throw new Error('Index must be a non-negative integer.');
          }

          return {
            success: true,
            index: updateIndex,
            reducerUpdate: {
              type: 'UPDATE_ITEM',
              payload: {
                index: updateIndex,
                item: {
                  ...(args.item.quantity !== undefined && {
                    quantity: Number(args.item.quantity),
                  }),
                  ...(args.item.discount !== undefined && {
                    discount: Number(args.item.discount),
                  }),
                  ...(args.item.instruction !== undefined && {
                    instruction: args.item.instruction,
                  }),
                  ...(args.item.item_variations && {
                    item_variations: args.item.item_variations.map((variation: any) => ({
                      attribute_id: Number(variation.attribute_id),
                      attribute_name: variation.attribute_name,
                      variation_id: Number(variation.variation_id),
                      variation_name: variation.variation_name,
                      extra_price: Number(variation.extra_price ?? 0),
                    })),
                  }),
                  ...(args.item.item_extras && {
                    item_extras: args.item.item_extras.map((extra: any) => ({
                      extra_id: Number(extra.extra_id),
                      extra_name: extra.extra_name,
                      qty: Number(extra.qty ?? 1),
                      price: Number(extra.price ?? 0),
                    })),
                  }),
                },
              },
            },
          };

        case 'setPayment':
          const paymentMap: { [key: string]: PosPaymentMethod } = {
            cash: PosPaymentMethod.CASH,
            card: PosPaymentMethod.CARD,
            mobile: PosPaymentMethod.MOBILE_BANKING,
            other: PosPaymentMethod.OTHER,
          };

          if (!paymentMap[args.method]) {
            throw new Error(`Unsupported payment method: ${args.method}`);
          }

          if (args.amount !== undefined && args.amount !== null && !Number.isFinite(Number(args.amount))) {
            throw new Error('Payment amount must be numeric when provided.');
          }

          return {
            success: true,
            reducerUpdate: {
              type: 'SET_PAYMENT',
              payload: {
                method: paymentMap[args.method],
                note: args.note,
                amount:
                  args.amount !== undefined && args.amount !== null
                    ? Number(args.amount)
                    : undefined,
              },
            },
          };

        case 'setTip':
          if (!Number.isFinite(Number(args.amount))) {
            throw new Error('Tip amount must be numeric.');
          }
          return {
            success: true,
            reducerUpdate: {
              type: 'SET_TIP',
              payload: Number(args.amount),
            },
          };

        case 'setDeliveryCharge':
          if (!Number.isFinite(Number(args.amount))) {
            throw new Error('Delivery charge must be numeric.');
          }
          return {
            success: true,
            reducerUpdate: {
              type: 'SET_DELIVERY_CHARGE',
              payload: Number(args.amount),
            },
          };

        case 'setDiscount':
          if (!Number.isFinite(Number(args.amount))) {
            throw new Error('Discount must be numeric.');
          }
          return {
            success: true,
            reducerUpdate: {
              type: 'SET_DISCOUNT',
              payload: Number(args.amount),
            },
          };

        case 'setDeliveryTime':
          return {
            success: true,
            reducerUpdate: {
              type: 'SET_DELIVERY_TIME',
              payload: args.time,
            },
          };

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error: any) {
      logger.error({ error, toolName: name }, 'Tool execution failed');
      return { success: false, error: error.message };
    }
  }
}

export default new AIAgent();
