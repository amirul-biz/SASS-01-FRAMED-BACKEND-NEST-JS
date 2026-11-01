import type {
  PhotographerProfile,
  User,
  UserPlatform,
} from '../../generated/prisma/client';
import type { EventCategory, OrderStatus } from '../../generated/prisma/enums';

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
  nickname: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  bannerUrl: string | null;
  createdAt: Date;
  eventCount: number;
  photoCount: number;
  topCategory: EventCategory | null;
}

export interface PhotographerDashboardTopEvent {
  eventId: string;
  title: string;
  orderCount: number;
  revenue: number;
}

export interface PhotographerDashboardStats {
  totalEvents: number;
  liveEvents: number;
  draftEvents: number;
  inactiveEvents: number;
  photoCount: number;
  storageBytes: number;
  ordersByStatus: Record<OrderStatus, number>;
  photosSold: number;
  grossRevenue: number;
  pendingRevenue: number;
  totalCommission: number;
  topEvents: PhotographerDashboardTopEvent[];
}
