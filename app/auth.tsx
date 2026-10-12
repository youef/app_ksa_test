import { useState, useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getBrandingLogo, FALLBACK_LOGO_URI, subscribeBrandingLogo, getCachedBrandingLogo } from '@/lib/branding';
import { C } from '@/lib/ui';
import { Mail, Lock, User, ArrowRight, Compass } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/shared/AppHeader';

export default function Auth() {
  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo());
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBrandingLogo().then(setLogoUri);
    return subscribeBrandingLogo(setLogoUri);
  }, []);

  async function submit() {
    if (!email.trim()) {
      return Alert.alert('تنبيه', 'الرجاء إدخال البريد الإلكتروني.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return Alert.alert('تنبيه', 'البريد الإلكتروني المدخل غير صحيح.');
    }
    if (!password) {
      return Alert.alert('تنبيه', 'الرجاء إدخال كلمة المرور.');
    }
    if (password.length < 6) {
      return Alert.alert('تنبيه', 'كلمة المرور يجب أن لا تقل عن 6 أحرف.');
    }
    if (!isLogin) {
      if (!username.trim()) {
        return Alert.alert('تنبيه', 'الرجاء إدخال معرف المستخدم.');
      }
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
        return Alert.alert('تنبيه', 'معرف المستخدم يجب أن يكون من 3 إلى 30 حرفاً، ويحتوي على أحرف إنجليزية وأرقام فقط.');
      }
    }

    setLoading(true);
    try {
      if (!isLogin) {
        const a = await supabase.rpc('is_username_available', { candidate: username.trim() });
        if (a.error) throw a.error;
        if (!a.data) return Alert.alert('تنبيه', 'هذا المعرف مستخدم مسبقاً، الرجاء اختيار معرف آخر.');
        const r = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim(), display_name: username.trim() } }
        });
        if (r.error) throw r.error;
        if (r.data.session) router.replace('/home');
        else Alert.alert('نجاح', 'تم التسجيل بنجاح. يرجى مراجعة بريدك الإلكتروني لتفعيله إن لزم الأمر.');
      } else {
        const r = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (r.error) throw r.error;

        // Wait until Supabase has persisted the session before navigating.
        // This prevents Expo Router from opening /home before auth state is available.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session?.user) throw new Error('تعذر حفظ جلسة الدخول، يرجى المحاولة مرة أخرى.');
        router.replace('/home');
      }
    } catch (e: any) {
      let errorMsg = e.message ?? 'حدث خطأ غير متوقع.';
      if (errorMsg.includes('Invalid login credentials')) {
        errorMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (errorMsg.includes('User already registered') || errorMsg.includes('already exists')) {
        errorMsg = 'البريد الإلكتروني مسجل مسبقاً.';
      } else if (errorMsg.includes('Password should be at least')) {
        errorMsg = 'كلمة المرور ضعيفة، يجب أن تحتوي على 6 أحرف على الأقل.';
      } else if (errorMsg.includes('rate limit')) {
        errorMsg = 'تجاوزت الحد المسموح للمحاولات، يرجى المحاولة لاحقاً.';
      } else if (errorMsg.includes('Email not confirmed')) {
        errorMsg = 'يرجى تأكيد البريد الإلكتروني أولاً.';
      } else if (errorMsg.includes('Network request failed')) {
        errorMsg = 'خطأ في الاتصال بالشبكة، يرجى التحقق من اتصالك بالإنترنت.';
      }
      Alert.alert('خطأ', errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <AppHeader
        variant="sub"
        title={isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
        subtitle="الشبكة الاجتماعية لجيرانك ومجتمعك المحلي"
        fallbackRoute="/home"
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.contentWrap}>
          {/* Segmented Control */}
          <View style={styles.segmentContainer}>
            <Pressable
              onPress={() => setIsLogin(true)}
              style={[styles.segmentBtn, isLogin && styles.segmentBtnActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.segmentBtnText, isLogin && styles.segmentBtnTextActive]}>تسجيل الدخول</Text>
            </Pressable>
            <Pressable
              onPress={() => setIsLogin(false)}
              style={[styles.segmentBtn, !isLogin && styles.segmentBtnActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.segmentBtnText, !isLogin && styles.segmentBtnTextActive]}>إنشاء حساب جديد</Text>
            </Pressable>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.brandBadgeRow}>
              <View style={styles.brandLogoSmall}>
                <Image source={{ uri: logoUri }} style={styles.brandLogoImg} resizeMode="contain" />
              </View>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <Text style={styles.brandBadgeTitle}>مرحباً بك في حيّنا 🇸🇦</Text>
                <Text style={styles.brandBadgeSub}>
                  {isLogin ? 'سجّل دخولك للمشاركة والتواصل مع جيرانك' : 'انضم لمجتمع وسوق وخدمات حيك اليوم'}
                </Text>
              </View>
            </View>

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>معرف المستخدم (اسم المستخدم)</Text>
                <View style={styles.inputWrapper}>
                  <User size={19} color="#059669" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="مثال: ahmed_123"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>البريد الإلكتروني</Text>
              <View style={styles.inputWrapper}>
                <Mail size={19} color="#059669" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>كلمة المرور</Text>
              <View style={styles.inputWrapper}>
                <Lock size={19} color="#059669" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
              onPress={submit}
              disabled={loading}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#059669', '#047857']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'جاري التنفيذ...' : isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب والانضمام'}
                </Text>
                {!loading && <ArrowRight size={18} color="#fff" style={{ marginRight: 6 }} />}
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.guestBtn}
              onPress={() => router.replace('/home')}
              accessibilityRole="button"
            >
              <Compass size={17} color="#047857" />
              <Text style={styles.guestBtnText}>تصفح كزائر دون تسجيل 🏠</Text>
            </Pressable>

            <View style={styles.switchWrapper}>
              <Text style={styles.switchLabel}>
                {isLogin ? 'ليس لديك حساب بعد؟ ' : 'لديك حساب بالفعل؟ '}
              </Text>
              <Pressable onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
                <Text style={styles.switchBtnText}>{isLogin ? 'سجل مجاناً' : 'تسجيل الدخول'}</Text>
              </Pressable>
            </View>

            <View style={styles.securityNote}>
              <Text style={styles.securityNoteText}>
                🛡️ بياناتك مشفرة ومحمية وفق أعلى معايير الخصوصية السعودية
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 20,
    alignItems: 'center',
  },
  contentWrap: {
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: 16,
    gap: 14,
  },
  segmentContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#e2e8f0',
    padding: 4,
    borderRadius: 16,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentBtnTextActive: {
    color: '#047857',
    fontWeight: '900',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  brandBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandLogoSmall: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogoImg: {
    width: 34,
    height: 34,
  },
  brandBadgeTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  brandBadgeSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 18,
    textAlign: 'right',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
    marginBottom: 6,
    fontSize: 12.5,
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
    fontWeight: '600',
  },
  submitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  submitGradient: {
    height: 50,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  guestBtn: {
    height: 46,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
  },
  guestBtnText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '800',
  },
  switchWrapper: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  switchLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  switchBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  switchBtnText: {
    color: '#059669',
    fontWeight: '900',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  securityNote: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  securityNoteText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
