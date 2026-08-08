import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../config/firebase/firebase.service';
import { PhotographerRepository } from './photographer.repository';
import {
  RegisterPhotographerInputDto,
  RegisterPhotographerOutputDto,
} from './photographer.dto';

@Injectable()
export class PhotographerService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly photographerRepository: PhotographerRepository,
  ) {}


  async registerPhotographer(
    input: RegisterPhotographerInputDto,
  ): Promise<RegisterPhotographerOutputDto> {
    let firebaseUser: { uid: string } | null = null;

    try {
      firebaseUser = await this.firebaseService.createUser(
        input.email,
        input.password,
      );

      const result =
        await this.photographerRepository.createPhotographerWithTransaction({
          firebaseId: firebaseUser.uid,
          email: input.email,
          name: input.name,
          bio: input.bio,
          companyName: input.companyName,
          phone: input.phone,
        });

      const output = new RegisterPhotographerOutputDto();
      output.success = true;
      output.message = 'Photographer registered successfully';
      output.data = result;

      return output;
    } catch (error) {
      if (firebaseUser?.uid) {
        await this.firebaseService.deleteUser(firebaseUser.uid);
      }
      throw new Error(`Registration failed: ${(error as Error).message}`);
    }
  }
}
