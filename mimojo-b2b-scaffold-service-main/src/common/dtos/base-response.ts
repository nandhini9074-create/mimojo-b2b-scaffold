interface IBaseResponse<T> {
  statusCode?: number;
  message?: string;
  data?: T;
}

export class BaseResponse<T> implements IBaseResponse<T> {
  /**
   * http status code [HttpStatus.CREATED, HttpStatus.OK, HttpStatus.BAD_REQUEST, etc.].
   */

  public statusCode?: number = 200;

  /**
   * message to be returned in the response.
   */

  public message?: string = 'Success';

  /**
   * data to be returned in the response (generic type). Can be any type of data [Item, Campaign, Project, Comment, etc.]
   */

  public data?: T;

  constructor(data?: T, code = 200, message = 'Success') {
    this.data = data;
    this.statusCode = code;
    this.message = message;
  }
}
