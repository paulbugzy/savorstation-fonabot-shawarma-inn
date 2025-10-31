import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import env from '@/config/env';
import logger from '@/utils/logger';

const router = Router();

const validateTwilioRequest = (req: Request, res: Response, next: Function) => {
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `${env.PUBLIC_URL}${req.originalUrl}`;

  const isValid = twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body
  );

  if (!isValid && env.NODE_ENV === 'production') {
    logger.warn({ url }, 'Invalid Twilio signature');
    return res.status(403).send('Forbidden');
  }

  next();
};

router.post(env.TWILIO_VOICE_WEBHOOK_PATH, validateTwilioRequest, (req: Request, res: Response) => {
  const { CallSid, From, To } = req.body;

  logger.info({ callSid: CallSid, from: From, to: To }, 'Incoming call');

  const response = new twilio.twiml.VoiceResponse();

  response.say(
    {
      voice: 'Polly.Joanna',
    },
    'Connecting you now, please wait.'
  );

  const connect = response.connect();
  const stream = connect.stream({
    url: `wss://${env.PUBLIC_URL.replace(/^https?:\/\//, '')}/twilio/stream`,
  });

  const parameters: Array<[string, string | undefined]> = [
    ['CallSid', CallSid],
    ['From', From],
    ['To', To],
  ];

  parameters.forEach(([name, value]) => {
    if (value) {
      stream.parameter({ name, value });
    }
  });

  res.type('text/xml');
  res.send(response.toString());
});

router.post(env.TWILIO_STATUS_WEBHOOK_PATH, validateTwilioRequest, (req: Request, res: Response) => {
  const { CallSid, CallStatus } = req.body;

  logger.info({ callSid: CallSid, status: CallStatus }, 'Call status update');

  res.sendStatus(200);
});

export default router;
