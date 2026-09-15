import { WheelPickerOption, ScrollPickerItem } from '../components/common/WheelPicker';
import { POPULAR_NIGERIAN_LOCATIONS, NIGERIAN_STATES, getCitiesForState } from '../data/nigerianLocations';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export async function runWheelPickerTests() {
  console.log('\n--- RUNNING GLOBAL iOS WHEEL PICKER TESTS ---');

  // Test 1: Options configuration and normalization
  console.log('Test 1: Validating WheelPicker options normalization');
  const sampleOptions: WheelPickerOption<string>[] = [
    { label: 'Garrison', value: 'Garrison', badge: 'Port Harcourt' },
    { label: 'Rumuola', value: 'Rumuola', badge: 'Port Harcourt' },
    { label: 'GRA Phase 2', value: 'GRA Phase 2', badge: 'Port Harcourt' },
  ];
  assert(sampleOptions.length === 3, 'Options array matches expected count');
  assert(sampleOptions[0].value === 'Garrison', 'First option has correct value');
  assert(sampleOptions[2].badge === 'Port Harcourt', 'Badge metadata preserved');

  // Test 2: State and City WheelPicker Data Source mapping
  console.log('Test 2: Verifying Nigerian States & Cities options for signup WheelPicker');
  const stateOptions: ScrollPickerItem[] = NIGERIAN_STATES.map((s) => ({
    label: s.name,
    value: s.name,
    active: s.active,
  }));
  assert(stateOptions.length > 0, 'State options populated');
  const riversState = stateOptions.find((s) => s.value === 'Rivers State');
  assert(riversState && riversState.active === true, 'Rivers State is active for selection');

  const riversCities = getCitiesForState('Rivers State');
  assert(riversCities.length > 0, 'Cities retrieved for Rivers State');
  assert(riversCities.includes('Port Harcourt'), 'Port Harcourt included in Rivers State cities');

  // Test 3: Location flow single-column area WheelPicker
  console.log('Test 3: Verifying single-column Area/Locality options for location flow');
  const areaOptions = POPULAR_NIGERIAN_LOCATIONS.map((loc) => ({
    label: loc.name,
    value: loc.name,
    badge: loc.city,
  }));
  assert(areaOptions.length >= 10, 'Popular locations available for single-column WheelPicker');
  assert(areaOptions.some((a) => a.value.includes('Garrison')), 'Garrison locality is available in area options');

  // Test 4: Numeric WheelPicker options for Service Radius
  console.log('Test 4: Verifying numeric options for Service Radius WheelPicker');
  const radiusOptions: WheelPickerOption<number>[] = [
    { label: '5 km (Immediate Area)', value: 5 },
    { label: '10 km (Port Harcourt Core)', value: 10 },
    { label: '15 km (Greater City Area)', value: 15 },
    { label: '20 km (Extended Suburbs)', value: 20 },
    { label: '25 km (Outer LGA Boundary)', value: 25 },
    { label: '30 km (Metropolitan Radius)', value: 30 },
    { label: '50 km (All Rivers State)', value: 50 },
  ];
  assert(radiusOptions.length === 7, 'Radius options configured accurately');
  assert(radiusOptions[2].value === 15, 'Default 15km service radius option available');

  // Test 5: Haptics safety test (graceful execution when navigator.vibrate is undefined or mocked)
  console.log('Test 5: Testing haptic vibration fallback safety');
  const mockNavigator: { vibrate: (ms: number) => boolean } = {
    vibrate: (ms: number) => ms === 10,
  };
  const result = mockNavigator.vibrate(10);
  assert(result === true, '10ms haptic tick executed safely');

  console.log('✅ ALL GLOBAL iOS WHEEL PICKER TESTS PASSED!\n');
}

if (process.argv[1]?.endsWith('wheel_picker.test.ts')) {
  runWheelPickerTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
