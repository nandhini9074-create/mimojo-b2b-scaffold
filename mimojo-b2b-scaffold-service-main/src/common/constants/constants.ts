import moment from 'moment';

export const constants = {
  saltOrRounds: 10,
  tokenExpiration: {
    INVITATION: {
      unit: 'week' as moment.DurationInputArg2,
      value: 1 as moment.DurationInputArg1,
      expiresIn: '7d',
      // unit: 'minute' as moment.DurationInputArg2,
      // value: 5 as moment.DurationInputArg1,
      // expiresIn: 300
    },
    ACCESS_TOKEN: {
      unit: 'day' as moment.DurationInputArg2,
      value: 1 as moment.DurationInputArg1,
      expiresIn: '1d',
      // unit: 'minute' as moment.DurationInputArg2,
      // value: 5 as moment.DurationInputArg1,
      // expiresIn: 300
    },
    RESEND_INVITATION: {
      unit: 'week' as moment.DurationInputArg2,
      value: 1 as moment.DurationInputArg1,
      expiresIn: '7d',
      // unit: 'minute' as moment.DurationInputArg2,
      // value: 5 as moment.DurationInputArg1,
      // expiresIn: 300
    },
    TEMPORARY: {
      unit: 'minute' as moment.DurationInputArg2,
      value: 10 as moment.DurationInputArg1,
      expiresIn: 600,
      // unit: 'minute' as moment.DurationInputArg2,
      // value: 5 as moment.DurationInputArg1,
      // expiresIn: 300
    },
    UPDATE: {
      unit: 'week' as moment.DurationInputArg2,
      value: 1 as moment.DurationInputArg1,
      expiresIn: '7d',
      // unit: 'minute' as moment.DurationInputArg2,
      // value: 5 as moment.DurationInputArg1,
      // expiresIn: 300
    },
  },
  auth: {
    incrementalTimerFactor: {
      percentage: 0.5, // 50%
      initialValue: 1, // it's per minute
      incrementEvery: 2, // tow attempts
    },
  },
};
