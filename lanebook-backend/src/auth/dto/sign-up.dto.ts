export class SignUpDto {
  email: string;
  password: string;
  display_name: string;
  phone: string;
  metadata?: Record<string, any>;
}
