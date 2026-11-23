import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform, ScrollView, Image, ImageBackground, type TextInput as NativeTextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { getBrandingLogo, subscribeBrandingLogo, getCachedBrandingLogo } from '@/lib/branding';
import { Mail, Lock, User, Compass, ShieldCheck, Eye, EyeOff, LogIn, UserRoundPlus, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { HAYNA_BUTTON } from '@/components/shared/haynaButtonTokens';
import { HaynaActionButton } from '@/components/shared/HaynaActionButton';
import { usePageBackground } from '@/hooks/usePageBackground';
import { useTheme } from '@/context/ThemeContext';

type FocusedField = 'username' | 'email' | 'password' | null;

export default function Auth() {
  const background = usePageBackground('login');
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo());
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const usernameRef = useRef<NativeTextInput | null>(null);
  const emailRef = useRef<NativeTextInput | null>(null);
  const passwordRef = useRef<NativeTextInput | null>(null);

  useEffect(() => {
    getBrandingLogo().then(setLogoUri);
    return subscribeBrandingLogo(setLogoUri);
  }, []);

  function changeMode(nextIsLogin: boolean) {
    if (loading) return;
    setIsLogin(nextIsLogin);
    setFormError('');
    setFormNotice('');
    setFocusedField(null);
    setShowPassword(false);
  }

  function clearFeedback() {
    if (formError) setFormError('');
    if (formNotice) setFormNotice('');
  }

  async function submit() {
    setFormError('');
    setFormNotice('');

    if (!email.trim()) {
      setFormError('الرجاء إدخال البريد الإلكتروني.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError('البريد الإلكتروني المدخل غير صحيح.');
      return;
    }
    if (!password) {
      setFormError('الرجاء إدخال كلمة المرور.');
      return;
    }
    if (password.length < 6) {
      setFormError('كلمة المرور يجب أن لا تقل عن 6 أحرف.');
      return;
    }
    if (!isLogin) {
      if (!username.trim()) {
        setFormError('الرجاء إدخال معرف المستخدم.');
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
        setFormError('معرف المستخدم يجب أن يكون من 3 إلى 30 حرفاً، ويحتوي على أحرف إنجليزية وأرقام فقط.');
        return;
      }
    }

    setLoading(true);
    try {
      if (!isLogin) {
        const a = await supabase.rpc('is_username_available', { candidate: username.trim() });
        if (a.error) throw a.error;
        if (!a.data) {
          setFormError('هذا المعرف مستخدم مسبقاً، الرجاء اختيار معرف آخر.');
          return;
        }
        const r = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim(), display_name: username.trim() } }
        });
        if (r.error) throw r.error;
        if (r.data.session) {
          // The profile trigger delivers the official welcome on the server,
          // including email-confirmation and OAuth registrations.
          router.replace('/home');
        } else {
          setFormNotice('تم التسجيل بنجاح. يرجى مراجعة بريدك الإلكتروني لتفعيله إن لزم الأمر.');
        }
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
      setFormError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ImageBackground source={background.source} onError={background.onError} resizeMode="cover" style={StyleSheet.absoluteFillObject} imageStyle={{ opacity: background.opacity }}>
        <View style={[styles.backgroundVeil, { backgroundColor: isDark ? 'rgba(2,12,9,0.62)' : 'rgba(250,249,241,0.18)' }]} />
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
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 16) }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={contentHeight > viewportHeight + 1}
          onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => setContentHeight(height)}
        >
          <View style={styles.contentWrap}>
            <View
              style={[styles.segmentContainer, { backgroundColor: colors.soft, borderColor: colors.line }]}
              accessibilityRole="radiogroup"
              accessibilityLabel="طريقة الدخول"
              accessibilityHint="اختر تسجيل الدخول أو إنشاء حساب جديد"
            >
              <Pressable
                oasisKind="plain"
                onPress={() => changeMode(true)}
                disabled={loading}
                style={[styles.segmentBtn, { backgroundColor: isLogin ? colors.surface : 'transparent', borderColor: isLogin ? colors.line : 'transparent' }]}
                accessibilityRole="radio"
                accessibilityLabel="تسجيل الدخول"
                accessibilityState={{ selected: isLogin, disabled: loading }}
                accessibilityHint={isLogin ? 'وضع تسجيل الدخول محدد' : 'التبديل إلى تسجيل الدخول'}
              >
                <View style={styles.segmentContent}>
                  <LogIn size={17} color={isLogin ? colors.primary : colors.muted} />
                  <Text style={[styles.segmentBtnText, { color: isLogin ? colors.primary : colors.muted }]}>تسجيل الدخول</Text>
                </View>
              </Pressable>
              <Pressable
                oasisKind="plain"
                onPress={() => changeMode(false)}
                disabled={loading}
                style={[styles.segmentBtn, { backgroundColor: !isLogin ? colors.surface : 'transparent', borderColor: !isLogin ? colors.line : 'transparent' }]}
                accessibilityRole="radio"
                accessibilityLabel="إنشاء حساب"
                accessibilityState={{ selected: !isLogin, disabled: loading }}
                accessibilityHint={!isLogin ? 'وضع إنشاء الحساب محدد' : 'التبديل إلى إنشاء حساب جديد'}
              >
                <View style={styles.segmentContent}>
                  <UserRoundPlus size={17} color={!isLogin ? colors.primary : colors.muted} />
                  <Text style={[styles.segmentBtnText, { color: !isLogin ? colors.primary : colors.muted }]}>إنشاء حساب</Text>
                </View>
              </Pressable>
            </View>

            <OasisSurface
              oasisSurface="card"
              style={[styles.formContainer, { backgroundColor: colors.surface, borderColor: colors.line }]}
            >
              <View style={[styles.brandBadgeRow, { borderBottomColor: colors.line }]}>
                <View style={[styles.brandLogoSmall, { backgroundColor: colors.soft, borderColor: colors.line }]}>
                  <Image accessible={false} source={{ uri: logoUri }} style={styles.brandLogoImg} resizeMode="contain" />
                </View>
                <View style={styles.brandCopy}>
                  <Text accessibilityRole="header" style={[styles.brandBadgeTitle, { color: colors.ink }]}>مرحباً بك في حيّنا</Text>
                  <Text style={[styles.brandBadgeSub, { color: colors.muted }]}>
                    {isLogin ? 'سجّل دخولك للمشاركة والتواصل مع جيرانك' : 'انضم لمجتمع وسوق وخدمات حيك اليوم'}
                  </Text>
                </View>
              </View>

              {!isLogin && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.ink }]}>معرف المستخدم (اسم المستخدم)</Text>
                  <OasisSurface
                    oasisSurface="field"
                    style={[styles.inputWrapper, { borderColor: focusedField === 'username' ? colors.primary : colors.line }]}
                  >
                    <User size={19} color={colors.primary} style={styles.inputIcon} />
                    <TextInput
                      ref={usernameRef}
                      style={[styles.input, styles.inputLtr, { color: colors.ink }]}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="username"
                      textContentType="username"
                      accessibilityLabel="معرف المستخدم"
                      accessibilityHint="من 3 إلى 30 حرفاً إنجليزياً أو رقمًا أو شرطة سفلية"
                      returnKeyType="next"
                      value={username}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(current => current === 'username' ? null : current)}
                      onSubmitEditing={() => emailRef.current?.focus()}
                      onChangeText={value => { setUsername(value); clearFeedback(); }}
                      placeholder="مثال: ahmed_123"
                      placeholderTextColor={colors.muted}
                    />
                  </OasisSurface>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.ink }]}>البريد الإلكتروني</Text>
                <OasisSurface
                  oasisSurface="field"
                  style={[styles.inputWrapper, { borderColor: focusedField === 'email' ? colors.primary : colors.line }]}
                >
                  <Mail size={19} color={colors.primary} style={styles.inputIcon} />
                  <TextInput
                    ref={emailRef}
                    style={[styles.input, styles.inputLtr, { color: colors.ink }]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    accessibilityLabel="البريد الإلكتروني"
                    accessibilityHint="أدخل البريد الإلكتروني المرتبط بحسابك"
                    returnKeyType="next"
                    value={email}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(current => current === 'email' ? null : current)}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    onChangeText={value => { setEmail(value); clearFeedback(); }}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.muted}
                  />
                </OasisSurface>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.ink }]}>كلمة المرور</Text>
                <OasisSurface
                  oasisSurface="field"
                  style={[styles.inputWrapper, { borderColor: focusedField === 'password' ? colors.primary : colors.line }]}
                >
                  <Lock size={19} color={colors.primary} style={styles.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    style={[styles.input, styles.inputLtr, { color: colors.ink }]}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    textContentType={isLogin ? 'password' : 'newPassword'}
                    accessibilityLabel="كلمة المرور"
                    accessibilityHint="ستة أحرف على الأقل"
                    returnKeyType="go"
                    value={password}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(current => current === 'password' ? null : current)}
                    onSubmitEditing={() => { void submit(); }}
                    onChangeText={value => { setPassword(value); clearFeedback(); }}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                  />
                  <Pressable
                    oasisKind="icon"
                    onPress={() => setShowPassword(value => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    accessibilityHint={showPassword ? 'إخفاء الأحرف المكتوبة' : 'إظهار الأحرف المكتوبة'}
                    accessibilityState={{ expanded: showPassword }}
                    hitSlop={4}
                    style={styles.eyeButton}
                  >
                    {showPassword ? <EyeOff size={19} color={colors.primary} /> : <Eye size={19} color={colors.muted} />}
                  </Pressable>
                </OasisSurface>
              </View>

              {formError ? (
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={[styles.feedback, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
                >
                  <AlertCircle size={19} color={colors.danger} />
                  <Text style={[styles.feedbackText, { color: colors.danger }]}>{formError}</Text>
                </View>
              ) : null}

              {formNotice ? (
                <View
                  accessible
                  accessibilityLiveRegion="polite"
                  style={[styles.feedback, { backgroundColor: colors.soft, borderColor: colors.primary }]}
                >
                  <CheckCircle2 size={19} color={colors.primary} />
                  <Text style={[styles.feedbackText, { color: colors.ink }]}>{formNotice}</Text>
                </View>
              ) : null}

              <HaynaActionButton
                title={loading ? 'جاري التنفيذ...' : isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب والانضمام'}
                onPress={submit}
                disabled={loading}
                accessibilityState={{ busy: loading, disabled: loading }}
                icon={!loading ? (isLogin ? <LogIn size={HAYNA_BUTTON.iconSize} color={colors.surface} /> : <UserRoundPlus size={HAYNA_BUTTON.iconSize} color={colors.surface} />) : undefined}
                style={styles.actionButton}
              />
              <HaynaActionButton
                title="تصفح كزائر دون تسجيل"
                variant="secondary"
                onPress={() => router.replace('/home')}
                icon={<Compass size={HAYNA_BUTTON.iconSize} color={colors.primary} />}
                style={styles.actionButton}
              />

              <View style={styles.switchWrapper}>
                <Text style={[styles.switchLabel, { color: colors.muted }]}>
                  {isLogin ? 'ليس لديك حساب بعد؟ ' : 'لديك حساب بالفعل؟ '}
                </Text>
                <Pressable oasisKind="action" onPress={() => changeMode(!isLogin)} disabled={loading} style={styles.switchBtn}>
                  <Text style={[styles.switchBtnText, { color: colors.primary }]}>{isLogin ? 'سجل مجاناً' : 'تسجيل الدخول'}</Text>
                </Pressable>
              </View>

              <View style={[styles.securityNote, { borderTopColor: colors.line }]}>
                <ShieldCheck size={16} color={colors.primary} />
                <Text style={[styles.securityNoteText, { color: colors.muted }]}>نحترم خصوصيتك ونحافظ على بيانات حسابك</Text>
              </View>
            </OasisSurface>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  background: { flex: 1, width: '100%' },
  backgroundVeil: { ...StyleSheet.absoluteFillObject },
  scroll: {
    flexGrow: 1,
    paddingTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrap: {
    width: '100%',
    maxWidth: HAYNA_BUTTON.maxContentWidth + 32,
    paddingHorizontal: 16,
    gap: 12,
  },
  segmentContainer: {
    flexDirection: 'row-reverse',
    borderWidth: 1,
    padding: 4,
    borderRadius: 18,
    gap: 4,
  },
  segmentContent: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentBtn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  segmentBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  formContainer: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  brandBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  brandLogoSmall: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogoImg: {
    width: 36,
    height: 36,
  },
  brandCopy: { alignItems: 'flex-end', flex: 1, minWidth: 0 },
  brandBadgeTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  brandBadgeSub: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 19,
    textAlign: 'right',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 7,
    fontSize: 13,
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    minHeight: 48,
  },
  inputIcon: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    height: '100%',
    fontWeight: '500',
    minWidth: 0,
  },
  inputLtr: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  eyeButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  feedback: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 2,
  },
  feedbackText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'right',
  },
  actionButton: { marginTop: HAYNA_BUTTON.verticalGap },
  switchWrapper: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
    flexWrap: 'wrap',
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  switchBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  switchBtnText: {
    fontWeight: '700',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  securityNote: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  securityNoteText: {
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
});
