import React from 'react';
import { View, Text, Image } from 'react-native';
import { chatStyles as styles } from './chatStyles';

export interface EmptyChatStateProps {
  otherUser: any;
  otherName: string;
  isAnonymous: boolean;
  blockedByMe: boolean;
  isCleared: boolean;
}

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  otherUser,
  otherName,
  isAnonymous,
  blockedByMe,
  isCleared,
}) => {
  return (
    <View style={styles.emptyConv}>
      <View style={styles.emptyConvIcon}>
        {otherUser?.avatar_url && !isAnonymous ? (
          <Image source={{ uri: otherUser.avatar_url }} style={styles.emptyConvAvatar as any} />
        ) : (
          <View style={styles.emptyConvAvatarFallback}>
            <Text style={styles.emptyConvAvatarLetter}>{otherName[0] || 'ج'}</Text>
          </View>
        )}
      </View>
      <Text style={styles.emptyConvName}>{otherName}</Text>
      {otherUser?.bio && !isAnonymous && <Text style={styles.emptyConvBio}>{otherUser.bio}</Text>}
      <Text style={styles.emptyConvHint}>
        {blockedByMe
          ? 'المحادثة مغلقة بسبب الحظر'
          : isCleared
          ? 'ابدأ محادثة جديدة — سترى رسائلك الجديدة فقط'
          : 'ابدأ محادثتك مع جارك بالحي 👋'}
      </Text>
    </View>
  );
};
