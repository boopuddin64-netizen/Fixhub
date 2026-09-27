import { strictEqual, ok } from 'node:assert';
import { IdentityVerificationService } from '../../server/services/identityVerificationService';
import { User, TechnicianProfile } from '../types';

export async function runTechnicianIdAndCacVerificationTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- RUNNING TECHNICIAN GOVERNMENT ID & CAC VERIFICATION TESTS ---');
  let passed = 0;
  let failed = 0;

  const testAssert = (cond: boolean, name: string, detail?: string) => {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  };

  // Mock User and Technician
  const mockUser: User = {
    id: 'tech_test_user_01',
    email: 'chidi.okafor@fixhub.ng',
    name: 'Chidi Okafor',
    phone: '+2348012345678',
    role: 'technician',
    createdAt: new Date().toISOString(),
  };

  const mockTech: TechnicianProfile = {
    userId: mockUser.id,
    businessName: "Chidi's Micro Tech Labs",
    bio: 'Board level iPhone microsoldering and diagnostics',
    shopLocation: {
      lat: 6.598,
      lng: 3.344,
      state: 'Lagos',
      city: 'Ikeja',
      address: 'Shop 14, Digital Square, Computer Village, Ikeja',
    },
    serviceRadiusKm: 15,
    businessHours: 'Mon-Sat: 9:00 AM - 6:00 PM',
    yearsExperience: 7,
    phone: '+2348012345678',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    shopPhotos: [],
    supportedBrands: ['Apple', 'Samsung'],
    supportedCategories: ['Screen Repair', 'Battery Replacement', 'Board Repair'],
    availability: 'AVAILABLE',
    rating: 4.9,
    reviewCount: 38,
    completedJobs: 45,
    quoteAccuracyScore: 98,
    cancellationRate: 1,
    averageResponseMinutes: 5,
    trustScore: 94,
    trustLevel: 'HIGHLY_TRUSTED',
    verificationStatus: {
      basic: true,
      identityVerified: false,
      businessVerified: false,
      locationConfirmed: true,
      payoutVerified: false,
    },
  };

  // 1. Driver's License verification
  try {
    const dlResult = await IdentityVerificationService.verifyGovernmentId(mockUser, mockTech, {
      idType: 'DRIVERS_LICENSE',
      idNumber: 'AAA12345AA01',
      dob: '1992-05-14',
    });

    testAssert(
      dlResult.success === true && dlResult.idType === 'DRIVERS_LICENSE',
      "1. Driver's License verification succeeds for matching account owner"
    );
    testAssert(
      Boolean(dlResult.idNumberMasked && dlResult.idNumberMasked.includes('*')),
      "2. Sensitive Driver's License number is properly masked for display"
    );
  } catch (err: any) {
    testAssert(false, "Driver's license test threw", err.message);
  }

  // 2. Voter's Card (INEC VIN) verification
  try {
    const vcResult = await IdentityVerificationService.verifyGovernmentId(mockUser, mockTech, {
      idType: 'VOTERS_CARD',
      idNumber: '90F5B0123456789',
    });

    testAssert(
      vcResult.success === true && vcResult.idType === 'VOTERS_CARD',
      "3. Voter's Card (INEC VIN) verification succeeds"
    );
  } catch (err: any) {
    testAssert(false, "Voter's card test threw", err.message);
  }

  // 3. Name matching logic - Government ID must NOT match shop name, but user real name
  try {
    const isPersonalMatch = IdentityVerificationService.isPersonalNameMatch('CHIDI OKAFOR', 'Chidi Okafor');
    testAssert(
      isPersonalMatch === true,
      "4. Government ID accurately matches user personal real name"
    );

    // If registry returns a completely different unrelated person
    const alienMatch = IdentityVerificationService.isPersonalNameMatch('BABATUNDE ADEKUNLE', 'Chidi Okafor');
    testAssert(
      alienMatch === false,
      "5. Government ID for a different individual is rejected (anti-identity theft)"
    );

    // Government ID should NOT match shop business name ("Chidi's Micro Tech Labs" is business, not a legal ID name)
    const isShopInsteadOfPerson = IdentityVerificationService.isPersonalNameMatch("CHIDI'S MICRO TECH LABS", "Babatunde Adekunle");
    testAssert(
      isShopInsteadOfPerson === false,
      "6. Government ID rejects mismatched shop names"
    );
  } catch (err: any) {
    testAssert(false, "Name matching test threw", err.message);
  }

  // 4. CAC Business Registration verification (RC / BN number)
  try {
    // Should match shop business name: "Chidi's Micro Tech Labs"
    const cacResult = await IdentityVerificationService.verifyCac(mockUser, mockTech, {
      cacNumber: 'RC-1849201',
      companyType: 'RC',
    });

    testAssert(
      cacResult.success === true && cacResult.rcNumber?.includes('1849201'),
      "7. CAC registration succeeds when company name matches shop business name"
    );

    // Business Name Match logic
    const cacMatchesShop = IdentityVerificationService.isBusinessNameMatch(
      "CHIDI'S MICRO TECH LABS LIMITED",
      mockTech.businessName
    );
    testAssert(
      cacMatchesShop === true,
      "8. CAC corporate name matches registered technician storefront name"
    );

    // Mismatched shop name should fail
    const cacMismatched = IdentityVerificationService.isBusinessNameMatch(
      "LAGOS FAST COURIER LOGISTICS PLC",
      mockTech.businessName
    );
    testAssert(
      cacMismatched === false,
      "9. Mismatched CAC company name is rejected"
    );

    // Zero-forgery check: completely non-existent CAC number MUST fail without synthesizing fake details
    const nonExistentCacResult = await IdentityVerificationService.verifyCac(mockUser, mockTech, {
      cacNumber: 'RC-999999999',
    });
    testAssert(
      nonExistentCacResult.success === false,
      "10. Non-existent CAC number is strictly rejected without forging fake details"
    );
  } catch (err: any) {
    testAssert(false, "CAC verification test threw", err.message);
  }

  // 5. Cross-Check Rule: Settlement Bank Account holder must match verified Government ID name
  try {
    const verifiedIdName = "CHIDI OKAFOR";
    const matchingAccount = "CHIDI OKAFOR";
    const mismatchedAccount = "ALHAJI MUSA BELLO";

    const canMatch = IdentityVerificationService.isPersonalNameMatch(verifiedIdName, matchingAccount);
    const cannotMatch = IdentityVerificationService.isPersonalNameMatch(verifiedIdName, mismatchedAccount);

    testAssert(canMatch === true, "11. Settlement bank account matching verified Government ID holder is approved");
    testAssert(cannotMatch === false, "12. Settlement bank account in third-party name is rejected");
  } catch (err: any) {
    testAssert(false, "Cross-check rule test threw", err.message);
  }

  console.log(`--- Finished Technician ID & CAC Verification Tests: ${passed} passed, ${failed} failed ---\n`);
  return { passed, failed };
}
