import { db } from '../../server/db';
import { AuthService } from '../../server/services/authService';

export async function runGoogleAuthTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running Google Authentication & Identity Verification Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  }

  const originalFetch = globalThis.fetch;
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '56408372166-fdcat8gp2ildbktlu1q5u3ab9pad5t0b.apps.googleusercontent.com';
  const createdUserIds: string[] = [];

  // Setup mock fetch for Google endpoints
  (globalThis as any).fetch = async (url: string, opts?: any) => {
    if (url.includes('oauth2.googleapis.com/tokeninfo?id_token=')) {
      const idToken = new URL(url).searchParams.get('id_token') || '';
      if (idToken.includes('invalid')) {
        return {
          ok: false,
          json: async () => ({ error: 'invalid_token', error_description: 'Invalid Value' }),
        };
      }
      if (idToken.includes('existingsig')) {
        return {
          ok: true,
          json: async () => ({
            aud: clientId,
            email: 'existing.google@example.com',
            name: 'Existing Customer Google',
            picture: 'https://lh3.googleusercontent.com/a/exist-photo',
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          aud: clientId,
          email: 'newcustomer.google@example.com',
          name: 'New Customer Google',
          picture: 'https://lh3.googleusercontent.com/a/cust-photo',
        }),
      };
    }

    if (url.includes('oauth2.googleapis.com/tokeninfo?access_token=')) {
      const accessToken = new URL(url).searchParams.get('access_token') || '';
      if (accessToken.includes('invalid')) {
        return {
          ok: false,
          json: async () => ({ error: 'invalid_token', error_description: 'Invalid Value' }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          aud: clientId,
          azp: clientId,
          email: 'newtech.google@example.com',
        }),
      };
    }

    if (url.includes('googleapis.com/oauth2/v3/userinfo')) {
      return {
        ok: true,
        json: async () => ({
          email: 'newtech.google@example.com',
          name: 'New Technician Google',
          picture: 'https://lh3.googleusercontent.com/a/tech-photo',
        }),
      };
    }

    return originalFetch(url, opts);
  };

  try {
    // 1. Google ID token customer sign up
    const fakeJwt = 'header.payload.signature';
    const result1 = await AuthService.socialLogin({
      provider: 'google',
      token: fakeJwt,
      role: 'customer',
    });

    assert(result1.success === true, 'Google ID token customer signup succeeded');
    assert(result1.user?.email === 'newcustomer.google@example.com', 'Google ID token customer email is verified');
    assert(result1.user?.role === 'customer', 'Customer role assigned correctly');
    assert(result1.user?.avatarUrl === 'https://lh3.googleusercontent.com/a/cust-photo', 'Customer avatar from Google retained');

    if (result1.user?.id) {
      createdUserIds.push(result1.user.id);
    }

    // 2. Google access token technician sign up
    const fakeAccessToken = 'ya29.a0AfH6SM...tech';
    const result2 = await AuthService.socialLogin({
      provider: 'google',
      token: fakeAccessToken,
      role: 'technician',
    });

    assert(result2.success === true, 'Google access token technician signup succeeded');
    assert(result2.user?.email === 'newtech.google@example.com', 'Google access token technician email verified');
    assert(result2.user?.role === 'technician', 'Technician role assigned correctly');
    assert(result2.user?.avatarUrl === 'https://lh3.googleusercontent.com/a/tech-photo', 'Technician avatar from Google retained');

    if (result2.user?.id) {
      createdUserIds.push(result2.user.id);
      const techProfile = db.technicianProfiles.find((t) => t.userId === result2.user!.id);
      assert(!!techProfile, 'Technician profile automatically created');
    }

    // 3. Existing user linking
    const existingId = `usr_test_exist_${Date.now()}`;
    const existingEmail = 'existing.google@example.com';
    createdUserIds.push(existingId);

    db.users.push({
      id: existingId,
      email: existingEmail,
      phone: '+2348011223344',
      name: 'Existing Account',
      role: 'customer',
      avatarUrl: 'https://example.com/existing.png',
      createdAt: new Date().toISOString(),
      emailVerified: false,
      phoneVerified: true,
      authProvider: 'local',
    } as any);
    db.save();

    const result3 = await AuthService.socialLogin({
      provider: 'google',
      token: 'header.payload.existingsig',
      role: 'customer',
    });

    assert(result3.success === true, 'Existing user linked via Google');
    assert(result3.user?.id === existingId, 'Existing user ID preserved');
    assert(result3.user?.phoneVerified === true, 'Existing phone verification preserved');

    // 4. Authenticated phone verification
    const testPhone = '+2348099887766';
    const reqRes = await AuthService.requestPhoneVerification(testPhone, result1.user?.id);
    assert(reqRes.success === true, 'Phone verification request initiated for social user');

    const record = (AuthService as any).phoneVerifyTokens.get(result1.user?.id) ||
      (AuthService as any).phoneVerifyTokens.get(testPhone.replace(/\s+/g, ''));
    assert(!!record, 'Phone verification token recorded');

    if (record) {
      const confirmRes = AuthService.confirmPhoneVerification(testPhone, record.code, result1.user?.id);
      assert(confirmRes.success === true, 'Phone verification confirmed');
      assert(confirmRes.user?.phoneVerified === true, 'User phoneVerified flag set to true');
      assert(confirmRes.user?.phone === testPhone, 'User phone updated to verified phone');
    }

    // 5. Invalid token rejection
    const invalidRes = await AuthService.socialLogin({
      provider: 'google',
      token: 'invalid.token.here',
      role: 'customer',
    });
    assert(invalidRes.success === false, 'Invalid Google token rejected gracefully');

  } finally {
    globalThis.fetch = originalFetch;
    for (const uid of createdUserIds) {
      db.users = db.users.filter((u) => u.id !== uid);
      db.customerProfiles = db.customerProfiles.filter((c) => c.userId !== uid);
      db.technicianProfiles = db.technicianProfiles.filter((t) => t.userId !== uid);
    }
    db.save();
  }

  return { passed, failed };
}
