import { IsEmail, IsJWT, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsNotEmptyString } from '../decorators/IsNotEmptyString';
import { IsMobileNumber } from '../helpers/utils';
import { Transform } from 'class-transformer';

export class IsEmailDto {
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value.trim().toLowerCase())
  email: string;
}

export class IsJwtTokenDto {
  @IsJWT()
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class IsMobilePhoneDto {
  @MaxLength(17)
  @MinLength(12)
  @IsNotEmpty()
  @IsMobileNumber()
  mobile: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Transform(({ value }) => value.trim().toLowerCase())
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export class PasswordDto {
  @IsString()
  @IsNotEmptyString()
  @Matches(/^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[A-Z])[a-zA-Z\d!@#$%^&*]{8,16}$/, {
    message: 'password too weak',
  })
  declare password: string;

  @Matches(/^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[A-Z])[a-zA-Z0-9!@#$%^&*]{8,16}$/, {
    message: 'repeated password too weak',
  })
  @IsString()
  @IsNotEmptyString()
  declare repeatedPassword: string;
}

export class AskToUpdateCredentialsDto {
  @IsString()
  @IsEmail()
  @IsOptional()
  @Transform(({ value }) => value.trim().toLowerCase())
  email: string;

  @MaxLength(17)
  @MinLength(12)
  @IsOptional()
  @IsMobileNumber()
  mobile: string;
}
