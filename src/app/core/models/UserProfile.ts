export interface UserPreferences {
  notifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  favoriteCategories: string[];
}



export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar?: string;
  memberSince: Date;
  preferences: UserPreferences;
}
