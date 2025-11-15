import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Lock, Mail, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// 密码强度计算函数
const calculatePasswordStrength = (password: string): { strength: 'weak' | 'medium' | 'strong' | 'very-strong', score: number, feedback: string[] } => {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 6) score += 1;
  else feedback.push("至少 6 個字元");

  if (password.length >= 8) score += 1;
  else if (password.length > 0) feedback.push("建議至少 8 個字元");

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else if (password.length > 0) feedback.push("建議包含大小寫字母");

  if (/\d/.test(password)) score += 1;
  else if (password.length > 0) feedback.push("建議包含數字");

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else if (password.length > 0) feedback.push("建議包含特殊字元");

  let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (score <= 2) strength = 'weak';
  else if (score === 3) strength = 'medium';
  else if (score === 4) strength = 'strong';
  else strength = 'very-strong';

  return { strength, score, feedback };
};

// 邮箱验证函数
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [touchedFields, setTouchedFields] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });

  // 计算密码强度
  const passwordStrength = useMemo(() => {
    if (!password) return null;
    return calculatePasswordStrength(password);
  }, [password]);

  // 实时邮箱验证
  useEffect(() => {
    if (!touchedFields.email) return;
    
    if (!email) {
      setEmailError("");
    } else if (!isValidEmail(email)) {
      setEmailError(t("auth.errors.invalidEmail") || "請輸入有效的電子郵件地址");
    } else {
      setEmailError("");
    }
  }, [email, touchedFields.email, t]);

  // 实时密码验证
  useEffect(() => {
    if (!touchedFields.password) return;
    
    if (!password) {
      setPasswordError("");
    } else if (password.length < 6) {
      setPasswordError(t("auth.errors.invalidPasswordDesc") || "密碼長度必須至少為 6 個字元");
    } else {
      setPasswordError("");
    }
  }, [password, touchedFields.password, t]);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        navigate("/auth-record");
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setUser(session.user);
          navigate("/auth-record");
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: t("auth.errors.missingInfo"),
        description: t("auth.errors.missingInfoDesc"),
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: t("auth.errors.invalidPassword"),
        description: t("auth.errors.invalidPasswordDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-record`,
        },
      });

      if (error) throw error;

      toast({
        title: t("auth.success.accountCreated"),
        description: t("auth.success.accountCreatedDesc"),
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: t("auth.errors.signupFailed"),
        description: error.message || t("auth.errors.signupFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: t("auth.errors.missingInfo"),
        description: t("auth.errors.missingInfoDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: t("auth.success.welcomeBack"),
        description: t("auth.success.welcomeBackDesc"),
      });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: t("auth.errors.loginFailed"),
        description: error.message || t("auth.errors.invalidCredentials"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      
      {/* Background effects */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 max-w-md mx-auto px-4 md:px-6 py-8 md:py-12">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4 md:mb-6"
          aria-label={t("common.backToHome")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.backToHome")}
        </Button>

        <Card className="glass-card p-6 md:p-8 space-y-4 md:space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full gradient-emotion shadow-md mb-4">
              <Lock className="w-7 h-7 md:w-8 md:h-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{t("auth.title")}</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {t("auth.subtitle")}
            </p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" aria-label={t("auth.signIn")}>{t("auth.signIn")}</TabsTrigger>
              <TabsTrigger value="signup" aria-label={t("auth.signUp")}>{t("auth.signUp")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t("auth.email")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder={t("auth.emailPlaceholder")}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setTouchedFields(prev => ({ ...prev, email: true }));
                      }}
                      onBlur={() => setTouchedFields(prev => ({ ...prev, email: true }))}
                      className={`pl-10 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      disabled={isLoading}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "signin-email-error" : undefined}
                      autoComplete="email"
                    />
                    {email && !emailError && (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" aria-hidden="true" />
                    )}
                    {emailError && (
                      <XCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" aria-hidden="true" />
                    )}
                  </div>
                  {emailError && (
                    <p id="signin-email-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3 w-3" />
                      {emailError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t("auth.password")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder={t("auth.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setTouchedFields(prev => ({ ...prev, password: true }));
                      }}
                      onBlur={() => setTouchedFields(prev => ({ ...prev, password: true }))}
                      className={`pl-10 ${passwordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      disabled={isLoading}
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError ? "signin-password-error" : undefined}
                      autoComplete="current-password"
                    />
                    {password && !passwordError && (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" aria-hidden="true" />
                    )}
                    {passwordError && (
                      <XCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" aria-hidden="true" />
                    )}
                  </div>
                  {passwordError && (
                    <p id="signin-password-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3 w-3" />
                      {passwordError}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-emotion shadow-md"
                  disabled={isLoading || !!emailError || !!passwordError || !email || !password}
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("auth.signingIn")}
                    </>
                  ) : (
                    t("auth.signIn")
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t("auth.email")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={t("auth.emailPlaceholder")}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setTouchedFields(prev => ({ ...prev, email: true }));
                      }}
                      onBlur={() => setTouchedFields(prev => ({ ...prev, email: true }))}
                      className={`pl-10 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      disabled={isLoading}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "signup-email-error" : undefined}
                      autoComplete="email"
                    />
                    {email && !emailError && (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" aria-hidden="true" />
                    )}
                    {emailError && (
                      <XCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" aria-hidden="true" />
                    )}
                  </div>
                  {emailError && (
                    <p id="signup-email-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3 w-3" />
                      {emailError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t("auth.password")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder={t("auth.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setTouchedFields(prev => ({ ...prev, password: true }));
                      }}
                      onBlur={() => setTouchedFields(prev => ({ ...prev, password: true }))}
                      className={`pl-10 ${passwordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      disabled={isLoading}
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError || passwordStrength ? "signup-password-error signup-password-strength" : undefined}
                      autoComplete="new-password"
                    />
                    {password && !passwordError && (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" aria-hidden="true" />
                    )}
                    {passwordError && (
                      <XCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" aria-hidden="true" />
                    )}
                  </div>
                  
                  {/* 密码强度指示器 */}
                  {password && passwordStrength && (
                    <div id="signup-password-strength" className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              passwordStrength.strength === 'weak' ? 'bg-red-500 w-1/4' :
                              passwordStrength.strength === 'medium' ? 'bg-yellow-500 w-2/4' :
                              passwordStrength.strength === 'strong' ? 'bg-blue-500 w-3/4' :
                              'bg-green-500 w-full'
                            }`}
                            role="progressbar"
                            aria-valuenow={passwordStrength.score}
                            aria-valuemin={0}
                            aria-valuemax={5}
                            aria-label={`密碼強度：${passwordStrength.strength}`}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          passwordStrength.strength === 'weak' ? 'text-red-500' :
                          passwordStrength.strength === 'medium' ? 'text-yellow-500' :
                          passwordStrength.strength === 'strong' ? 'text-blue-500' :
                          'text-green-500'
                        }`}>
                          {passwordStrength.strength === 'weak' ? '弱' :
                           passwordStrength.strength === 'medium' ? '中等' :
                           passwordStrength.strength === 'strong' ? '強' :
                           '非常強'}
                        </span>
                      </div>
                      {passwordStrength.feedback.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {passwordStrength.feedback.map((item, index) => (
                            <li key={index} className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  
                  {passwordError && (
                    <p id="signup-password-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3 w-3" />
                      {passwordError}
                    </p>
                  )}
                  {!password && (
                  <p className="text-xs text-muted-foreground">
                    {t("auth.passwordHint")}
                  </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-emotion shadow-md"
                  disabled={isLoading || !!emailError || !!passwordError || !email || !password || password.length < 6}
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("auth.creatingAccount")}
                    </>
                  ) : (
                    t("auth.createAccount")
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

// 使用 React.memo 优化性能
export default React.memo(Auth);
