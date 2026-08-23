import type {
  PhotographerProfile,
  User,
  UserPlatform,
} from '../../generated/prisma/client';
import type { EventCategory } from '../../generated/prisma/enums';

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

export interface TopPhotographerByEventCount {
  id: string;
  name: string;
  bio: string | null;
  profileImageUrl: string | null;
  bannerUrl: string | null;
  eventCount: number;
}

export interface PublicPhotographerProfile {
  id: string;
  name: string;
  bio: string | null;
  profileImageUrl: string | null;
  bannerUrl: string | null;
  createdAt: Date;
  eventCount: number;
  photoCount: number;
  topCategory: EventCategory | null;
}
