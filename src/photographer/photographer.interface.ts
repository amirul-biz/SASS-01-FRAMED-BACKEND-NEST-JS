import type {
  PhotographerProfile,
  User,
  UserPlatform,
} from '../../generated/prisma/client';

export interface CreatePhotographerProfileData {
  firebaseId: string;
  email: string;
  name: string;
  bio?: string;
  companyName?: string;
  phone?: string;
}

export interface CreatePhotographerProfileResult {
  user: User;
  userPlatform: UserPlatform;
  photographerProfile: PhotographerProfile;
}
