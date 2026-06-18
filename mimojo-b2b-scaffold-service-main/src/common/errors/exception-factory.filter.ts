import { BadRequestException, ValidationError } from '@nestjs/common';

export const exceptionFactory = (validationErrors: ValidationError[] = []) => {
  const errors: string[] = [];
  validationErrors.forEach(
    (error: ValidationError) =>
      error.constraints && Object.values(error.constraints).forEach((value: string) => errors.push(value))
  );
  return new BadRequestException(`${errors}`);
};
