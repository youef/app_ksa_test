import { useState, useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView, Image, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getBrandingLogo, FALLBACK_LOGO_URI, subscribeBrandingLogo, getCachedBrandingLogo } from '@/lib/branding';
import { Mail, Lock, User, ArrowRight, Compass, ShieldCheck, Eye, EyeOff, LogIn, UserRoundPlus } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';

const LOGIN_BUTTON_BACKGROUND = { uri: Platform.OS === 'web' ? '/images/buttons/hayna-login-button-bg.png' : 'https://appksatest.vercel.app/images/buttons/hayna-login-button-bg.png' };
const AUTH_BACKGROUND = { uri: 'https://appksatest.vercel.app/welcome/welcome-background.png' };

export default function Auth() {
  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo());
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

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
    <View style={styles.container}>
      <ImageBackground source={AUTH_BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFillObject} imageStyle={styles.backgroundImage}>
        <View style={styles.backgroundVeil} />
      </ImageBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.background}>
      <AppHeader
        variant="sub"
        title={isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
        subtitle="الشبكة الاجتماعية لجيرانك ومجتمعك المحلي"
        fallbackRoute="/home"
      />
      <ScrollView
        style={styles.background}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={contentHeight > viewportHeight + 1}
        onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setContentHeight(height)}
      >
        <View style={styles.contentWrap}>
          {/* Segmented Control */}
          <View style={styles.segmentContainer}>
            <Pressable
              onPress={() => setIsLogin(true)}
              style={[styles.segmentBtn, isLogin && styles.segmentBtnActive]}
              accessibilityRole="button"
            >
              <View style={styles.segmentContent}><LogIn size={16} color={isLogin ? "#047857" : "#64748b"} /><Text style={[styles.segmentBtnText, isLogin && styles.segmentBtnTextActive]}>تسجيل الدخول</Text></View>
            </Pressable>
            <Pressable
              onPress={() => setIsLogin(false)}
              style={[styles.segmentBtn, !isLogin && styles.segmentBtnActive]}
              accessibilityRole="button"
            >
              <View style={styles.segmentContent}><UserRoundPlus size={16} color={!isLogin ? "#047857" : "#64748b"} /><Text style={[styles.segmentBtnText, !isLogin && styles.segmentBtnTextActive]}>إنشاء حساب</Text></View>
            </Pressable>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.brandBadgeRow}>
              <View style={styles.brandLogoSmall}>
                <Image source={{ uri: logoUri }} style={styles.brandLogoImg} resizeMode="contain" />
              </View>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <Text style={styles.brandBadgeTitle}>مرحباً بك في حيّنا</Text>
                <Text style={styles.brandBadgeSub}>
                  {isLogin ? 'سجّل دخولك للمشاركة والتواصل مع جيرانك' : 'انضم لمجتمع وسوق وخدمات حيك اليوم'}
                </Text>
              </View>
            </View>

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>معرف المستخدم (اسم المستخدم)</Text>
                <View style={styles.inputWrapper}>
                  <User size={19} color="#047857" style={styles.inputIcon} />
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
                <Mail size={19} color="#047857" style={styles.inputIcon} />
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
                <Lock size={19} color="#047857" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                />
                <Pressable onPress={() => setShowPassword(v => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} hitSlop={10} style={styles.eyeButton}>
                  {showPassword ? <EyeOff size={19} color="#047857" /> : <Eye size={19} color="#64748b" />}
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
              onPress={submit}
              disabled={loading}
              accessibilityRole="button"
            >
              <View style={styles.submitGradient}>
                <Image source={LOGIN_BUTTON_BACKGROUND} resizeMode="stretch" style={styles.submitArtwork} pointerEvents="none" />
                <Text style={styles.submitBtnText}>
                  {loading ? 'جاري التنفيذ...' : isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب والانضمام'}
                </Text>
                {!loading && (isLogin ? <LogIn size={19} color="#fff" /> : <UserRoundPlus size={19} color="#fff" />)}
              </View>
            </Pressable>

            <Pressable
              style={styles.guestBtn}
              onPress={() => router.replace('/home')}
              accessibilityRole="button"
            >
              <Compass size={17} color="#047857" />
              <Text style={styles.guestBtnText}>تصفح كزائر دون تسجيل</Text>
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
              <ShieldCheck size={16} color="#047857" />
              <Text style={styles.securityNoteText}>نحترم خصوصيتك ونحافظ على بيانات حسابك</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3E9',
    overflow: 'hidden',
  },
  background: { flex: 1, width: '100%' },
  backgroundImage: { opacity: 0.32 },
  backgroundVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(250,249,241,0.18)' },
  scroll: {
    flexGrow: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrap: {
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: 16,
    gap: 10,
  },
  segmentContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,253,247,0.92)',
    borderWidth: 1,
    borderColor: '#E2ECE6',
    padding: 4,
    borderRadius: 16,
    gap: 4,
  },
  segmentContent: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
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
    backgroundColor: 'rgba(255,253,247,0.88)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    padding: 18,
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
    marginBottom: 12,
    paddingBottom: 12,
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
    marginBottom: 12,
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#C8DCD0',
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
  eyeButton: { padding: 7, marginLeft: 2 },
  submitArtwork: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  submitBtn: {
    marginTop: 10,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'visible',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  submitGradient: {
    height: 62,
    width: '100%',
    backgroundColor: 'transparent',
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
    color: '#047857',
    fontWeight: '900',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  securityNote: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 6,
  },
  securityNoteText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
