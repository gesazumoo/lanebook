import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() signUpDto: SignUpDto) {
    return await this.authService.signUp(
      signUpDto.email,
      signUpDto.password,
      signUpDto.display_name,
      signUpDto.phone,
      signUpDto.metadata,
    );
  }

  @Post('signup-admin')
  @HttpCode(HttpStatus.CREATED)
  async signUpAdmin(@Body() signUpDto: SignUpDto) {
    return await this.authService.signUpAdmin(
      signUpDto.email,
      signUpDto.password,
      signUpDto.display_name,
      signUpDto.phone,
      signUpDto.metadata,
    );
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInDto: SignInDto) {
    return await this.authService.signIn(signInDto.email, signInDto.password);
  }

  @Post('signin-admin')
  @HttpCode(HttpStatus.OK)
  async signInAdmin(@Body() signInDto: SignInDto) {
    return await this.authService.signInAdmin(
      signInDto.email,
      signInDto.password,
    );
  }

  @Post('signout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async signOut(@Headers('authorization') authorization: string) {
    const accessToken = authorization?.replace('Bearer ', '') || '';
    return await this.authService.signOut(accessToken);
  }
}
