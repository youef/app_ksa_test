import React from 'react';
import { View, Text, Pressable, Image, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, ExternalLink, Award, Coffee, Sparkles, Check, CheckCheck } from 'lucide-react-native';
import { navigationUrl } from '@/lib/privacy';
import { chatStyles as styles } from './chatStyles';

export interface MessageItem {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  conversation_id?: string;
  read_by?: string[];
  _optimisticKey?: string;
}

export interface AppreciationPayload {
  type: 'appreciation';
  title?: string;
  note: string;
  points?: number;
  giver_name?: string;
}

export function parseImageMessage(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed?.type === 'image' && parsed?.url ? parsed : null;
  } catch {
    return null;
  }
}

export function isUserFriendlyCaption(name?: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed === 'صورة' || trimmed === 'image') return false;
  if (/\.(webp|jpg|jpeg|png|gif|heic|svg)$/i.test(trimmed)) return false;
  if (/^[0-9a-fA-F-]{20,}/.test(trimmed)) return false;
  return true;
}

export function parseLocationMessage(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.type !== 'location') return null;
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: typeof parsed.label === 'string' ? parsed.label : '' };
  } catch {
    return null;
  }
}

export function parseAppreciationMessage(value: string): AppreciationPayload | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.type !== 'appreciation') return null;
    return {
      type: 'appreciation',
      title: parsed.title || '☕ بطاقة شكر وقهوة الجيران',
      note: parsed.note || 'كفو يا جارنا، بيض الله وجهك 🤍',
      points: Number(parsed.points) || 10,
      giver_name: parsed.giver_name || '',
    };
  } catch {
    return null;
  }
}

export function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  if (isSameDay(d, now)) return 'اليوم';
  const yday = new Date(now);
  yday.setDate(now.getDate() - 1);
  if (isSameDay(d, yday)) return 'أمس';
  return d.toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatMsgTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

export interface MessageBubbleProps {
  msg: MessageItem;
  prevMsg?: MessageItem;
  currentUserId: string;
  otherUser: any;
  otherName: string;
  isAnonymous: boolean;
  onPreviewImage: (url: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  prevMsg,
  currentUserId,
  otherUser,
  otherName,
  isAnonymous,
  onPreviewImage,
}) => {
  const isMine = msg.sender_id === currentUserId;
  const isRead =
    Array.isArray(msg.read_by) &&
    Boolean(otherUser?.id) &&
    msg.read_by.includes(otherUser.id);

  const showDate =
    !prevMsg || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));

  return (
    <View key={msg.id}>
      {showDate && <Text style={styles.dateDivider}>{formatDateLabel(msg.created_at)}</Text>}
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && (
          <View style={styles.otherAvatar}>
            {otherUser?.avatar_url && !isAnonymous ? (
              <Image source={{ uri: otherUser.avatar_url }} style={styles.otherAvatarImg as any} />
            ) : (
              <View style={styles.otherAvatarFallback}>
                <Text style={styles.otherAvatarLetter}>{otherName[0] || 'ج'}</Text>
              </View>
            )}
          </View>
        )}
        <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
          {(() => {
            const place = parseLocationMessage(msg.body);
            if (place) {
              return (
                <View style={[styles.locationCardOuter, isMine && styles.locationCardOuterMine]}>
                  <View style={styles.locationCardHeader}>
                    <View style={[styles.locationPinIconWrap, isMine && styles.locationPinIconWrapMine]}>
                      <MapPin size={18} color="#059669" />
                    </View>
                    <View style={styles.locationInfoCol}>
                      <Text style={styles.locationHeaderTitle}>
                        {isMine ? '📍 موقعي الدقيق المشترك' : '📍 موقع الجار المشترك'}
                      </Text>
                      <Text style={styles.locationDistrictTitle} numberOfLines={1}>
                        {place.label ? `حي ${place.label}` : 'موقع على الخريطة'}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={styles.locationNavBtn}
                    onPress={() => Linking.openURL(navigationUrl(place.lat, place.lng))}
                    accessibilityRole="button"
                    accessibilityLabel="فتح في خرائط Google"
                  >
                    <ExternalLink size={13} color="#ffffff" />
                    <Text style={styles.locationNavBtnText}>فتح في خرائط Google</Text>
                  </Pressable>
                </View>
              );
            }

            const media = parseImageMessage(msg.body);
            if (media) {
              const hasRealCaption = isUserFriendlyCaption(media.name);
              return (
                <View style={styles.imageMsgContainer}>
                  <Pressable
                    onPress={() => onPreviewImage(media.url)}
                    style={styles.imagePressable}
                    accessibilityRole="button"
                    accessibilityLabel="عرض الصورة بالحجم الكامل"
                  >
                    <Image
                      source={{ uri: media.url }}
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                  {hasRealCaption && (
                    <Text style={[styles.imageCaption, isMine && styles.msgTextMine]}>
                      {media.name}
                    </Text>
                  )}
                </View>
              );
            }

            const appreciation = parseAppreciationMessage(msg.body);
            if (appreciation) {
              return (
                <View style={[styles.appreciationCardOuter, isMine && styles.appreciationCardOuterMine]}>
                  <LinearGradient
                    colors={['#fffbeb', '#fef3c7', '#fde68a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.appreciationGrad}
                  >
                    <View style={styles.appreciationTopRow}>
                      <View style={styles.appreciationBadge}>
                        <Award size={12} color="#92400e" />
                        <Text style={styles.appreciationBadgeText}>
                          +{appreciation.points || 10} نقاط سمعة ⭐
                        </Text>
                      </View>
                      <View style={styles.appreciationCoffeeIconWrap}>
                        <Coffee size={20} color="#78350f" />
                      </View>
                    </View>

                    <Text style={styles.appreciationTitle}>
                      {appreciation.title || 'بطاقة شكر وقهوة الجيران'}
                    </Text>
                    <Text style={styles.appreciationNoteText}>"{appreciation.note}"</Text>

                    <View style={styles.appreciationDivider} />

                    <View style={styles.appreciationFooterRow}>
                      <Sparkles size={13} color="#92400e" />
                      <Text style={styles.appreciationFooterText}>
                        {isMine
                          ? 'أرسلت قهوة وشكراً لجيرانك ☕'
                          : `أهداك ${appreciation.giver_name || otherName} قهوة وشكراً لحسن جوارك ☕`}
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              );
            }

            return <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{msg.body}</Text>;
          })()}

          <View style={[styles.msgMeta, isMine && styles.msgMetaMine]}>
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
              {formatMsgTime(msg.created_at)}
            </Text>
            {isMine &&
              (isRead ? (
                <CheckCheck size={12} color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />
              ) : (
                <Check size={12} color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />
              ))}
          </View>
        </View>
      </View>
    </View>
  );
};
