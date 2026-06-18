export const ErrorMessages = {
  common: {
    entityNotFound: (name = 'entity') => {
      return {
        message: `${name} not found.`,
        serverStatus: 404,
      };
    },
    emailAlreadyExists: {
      message: 'Email address already exists.',
      serverStatus: 4000,
    },
    invalidPhoneNumber: {
      message: 'Invalid mobile number .',
      serverStatus: 4002,
    },
    mobileAlreadyExists: {
      message: 'Mobile number already exist.',
      serverStatus: 4003,
    },
    accessNotAllowed: {
      message: 'Unauthorized access.',
      serverStatus: 4003,
    },
    tooManyRequests: {
      message: 'Please wait a moment before trying again.',
      serverStatus: 4004,
    },
    invalidToken: {
      message: 'Invalid access token.',
      serverStatus: 4005,
    },
  },
  auth: {
    invalidCredentials: {
      message: 'Invalid login credentials.',
      serverStatus: 4101,
    },
    invalidToken: {
      message: 'Invalid access token.',
      serverStatus: 4102,
    },
    accessUnauthorized: {
      message: 'Unauthorized access.',
      serverStatus: 4103,
    },
    merchantAlreadyRegistered: {
      message: 'Merchant already exist.',
      serverStatus: 4104,
    },
    invalidOtpCode: {
      message: 'Invalid OTP.',
      serverStatus: 4105,
    },
    passwordAndRepeatedPasswordMustMatch: {
      message: 'Passwords do not match.',
      serverStatus: 4106,
    },
    invalidEmail: {
      message: 'Invalid email address.',
      serverStatus: 4107,
    },
    expiredToken: {
      message: 'Token expired.',
      serverStatus: 4108,
    },
  },
};
