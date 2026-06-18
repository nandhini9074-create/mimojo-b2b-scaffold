import { HttpStatus } from '@nestjs/common';
import { BaseResponse } from '../dtos/base-response';

/**
 * Helper function to create base response (standard response for all controllers).
 * @param data [Required] data to be returned in the response (generic type). Can be any type of data [Item, Campaign, Project, Comment, etc.]
 * @param statusCode [Optional] [Default: 200], http status code [HttpStatus.CREATED, HttpStatus.OK, HttpStatus.BAD_REQUEST, etc.].
 * @param message [Optional] [Default: "Sucess"], message to be returned in the response.
 * @returns {BaseResponse<T>} base response with data and status code.
 */
export function baseResponseHelper<T>(data: T, statusCode = HttpStatus.OK, message = 'Success'): BaseResponse<T> {
  const baseResponse = new BaseResponse<T>();
  baseResponse.data = data;
  baseResponse.statusCode = statusCode;
  baseResponse.message = message;

  return {
    statusCode: baseResponse.statusCode,
    message: baseResponse.message,
    data: baseResponse.data,
  };
}
