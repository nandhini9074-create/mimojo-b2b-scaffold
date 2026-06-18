import { isValidPhoneNumber, parsePhoneNumber, parsePhoneNumberWithError, PhoneNumber } from 'libphonenumber-js';
import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * @deprecated The method should not be used any more, use Instead @IsMobileNumber
 */
export function ValidatePhoneNumber(mobileNumber: number | string): boolean {
  if (typeof mobileNumber !== 'string') mobileNumber = mobileNumber.toString();
  // if the number starts with '00' then replace it with '+'
  mobileNumber = TransferPhoneNumberToOurStandard(mobileNumber);
  const phoneNumber: PhoneNumber = parsePhoneNumber(mobileNumber);
  if (phoneNumber) {
    return phoneNumber.isValid() && isValidPhoneNumber(mobileNumber);
  }
  return false;
}

export interface Pagination {
  page: number;
  pageCount: number;
  total: number;
  count: number;
}

export function generatePaginationObject(paginationRequest, totalCount: number, count: number) {
  return {
    page: paginationRequest.page,
    pageCount: Math.ceil(totalCount / paginationRequest.limit),
    total: totalCount,
    count: count,
  };
}

export function IsMobileNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsMobileNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: { ...validationOptions, message: 'Invalid Mobile Number' },
      validator: {
        validate(value: string) {
          let phoneNumber: PhoneNumber;
          try {
            phoneNumber = parsePhoneNumberWithError(value);
          } catch (error) {
            return false;
          }

          if (phoneNumber) {
            return phoneNumber.isValid() && isValidPhoneNumber(value) && phoneNumber.number == value;
          }
          return false;
        },
      },
    });
  };
}

export function TransferPhoneNumberToOurStandard(mobileNumber: string): string {
  if (mobileNumber.startsWith('00')) {
    mobileNumber = `+${mobileNumber.substring(2)}`;
  }
  if (mobileNumber.indexOf('+') === -1) {
    mobileNumber = `+${mobileNumber}`;
  }
  return mobileNumber;
}
