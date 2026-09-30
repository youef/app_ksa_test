import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { Mail, Lock, User, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        
        <LinearGradient 
          colors={['#0891b2', '#0e7490']} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }}
          style={styles.headerHero}
        >
          <View style={styles.heroContent}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>ح</Text>
            </View>
            <Text style={styles.title}>حيّنا</Text>
            <Text style={styles.subtitle}>الشبكة الاجتماعية لجيرانك ومجتمعك المحلي</Text>
          </View>
          <View style={styles.curveBottom} />
        </LinearGradient>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {isLogin ? 'تسجيل الدخول لحسابك' : 'إنشاء حساب جديد'}
          </Text>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>معرف المستخدم</Text>
              <View style={styles.inputWrapper}>
                <User size={20} color={C.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="مثال: ahmed_123"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>البريد الإلكتروني</Text>
            <View style={styles.inputWrapper}>
              <Mail size={20} color={C.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.inputWrapper}>
              <Lock size={20} color={C.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
            onPress={submit}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>
              {loading ? 'جاري التنفيذ...' : isLogin ? 'دخول' : 'إنشاء الحساب'}
            </Text>
            {!loading && <ArrowRight size={20} color="#fff" style={{ marginRight: 8 }} />}
          </Pressable>

          <View style={styles.switchWrapper}>
            <Text style={styles.switchLabel}>
              {isLogin ? 'ليس لديك حساب؟ ' : 'لديك حساب بالفعل؟ '}
            </Text>
            <Pressable onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
              <Text style={styles.switchBtnText}>{isLogin ? 'سجل الآن مجاناً' : 'تسجيل الدخول'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: C.bg,
  },
  headerHero: {
    paddingTop: 80,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    position: 'relative',
  },
  heroContent: {
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: 20,
  },
  logoBox: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#cffafe',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 250,
  },
  curveBottom: {
    position: 'absolute',
    bottom: -30,
    width: '100%',
    height: 60,
    backgroundColor: 'transparent',
  },
  formContainer: {
    flex: 1,
    padding: 24,
    marginTop: -30,
    backgroundColor: C.card,
    marginHorizontal: 20,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
    marginBottom: 40,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: C.ink,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontWeight: '800',
    color: '#374151',
    textAlign: 'right',
    marginBottom: 8,
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    color: C.ink,
    height: '100%',
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    height: 56,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  switchWrapper: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  switchLabel: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  switchBtn: {
    paddingVertical: 4,
  },
  switchBtnText: {
    color: C.accent,
    fontWeight: '900',
    fontSize: 14,
  },
});