import { ApiProperty } from '@nestjs/swagger';

export class AudienceProofResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    example: 'http://localhost:3000/uploads/audience/abc.jpg',
  })
  url!: string;

  @ApiProperty()
  sortOrder!: number;
}
