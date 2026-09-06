import { DeviceBrand, DeviceFamily, DeviceModel } from '../../src/types/index';

export const seedBrands: DeviceBrand[] = [
  { id: 'brand_apple', name: 'Apple', slug: 'apple', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 42 },
  { id: 'brand_samsung', name: 'Samsung', slug: 'samsung', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 56 },
  { id: 'brand_tecno', name: 'Tecno', slug: 'tecno', deviceTypes: ['PHONE'], popularModelsCount: 28 },
  { id: 'brand_infinix', name: 'Infinix', slug: 'infinix', deviceTypes: ['PHONE'], popularModelsCount: 24 },
  { id: 'brand_xiaomi', name: 'Xiaomi / Redmi', slug: 'xiaomi', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 36 },
  { id: 'brand_google', name: 'Google Pixel', slug: 'google', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 18 },
  { id: 'brand_oneplus', name: 'OnePlus', slug: 'oneplus', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 16 },
  { id: 'brand_oppo', name: 'OPPO', slug: 'oppo', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 22 },
  { id: 'brand_vivo', name: 'Vivo', slug: 'vivo', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 20 },
  { id: 'brand_huawei', name: 'Huawei', slug: 'huawei', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 20 },
  { id: 'brand_motorola', name: 'Motorola', slug: 'motorola', deviceTypes: ['PHONE'], popularModelsCount: 14 },
  { id: 'brand_nokia', name: 'Nokia', slug: 'nokia', deviceTypes: ['PHONE'], popularModelsCount: 12 },
  { id: 'brand_realme', name: 'Realme', slug: 'realme', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 18 },
  { id: 'brand_sony', name: 'Sony', slug: 'sony', deviceTypes: ['PHONE'], popularModelsCount: 10 },
  { id: 'brand_asus', name: 'ASUS', slug: 'asus', deviceTypes: ['PHONE'], popularModelsCount: 8 },
  { id: 'brand_nothing', name: 'Nothing', slug: 'nothing', deviceTypes: ['PHONE'], popularModelsCount: 5 },
  { id: 'brand_other', name: 'Other Brand', slug: 'other', deviceTypes: ['PHONE', 'TABLET'], popularModelsCount: 5 },
];

export const seedFamilies: DeviceFamily[] = [
  // Apple
  { id: 'fam_apple_iphone', brandId: 'brand_apple', name: 'iPhone', deviceType: 'PHONE' },
  { id: 'fam_apple_ipad', brandId: 'brand_apple', name: 'iPad (Standard)', deviceType: 'TABLET' },
  { id: 'fam_apple_ipad_mini', brandId: 'brand_apple', name: 'iPad mini', deviceType: 'TABLET' },
  { id: 'fam_apple_ipad_air', brandId: 'brand_apple', name: 'iPad Air', deviceType: 'TABLET' },
  { id: 'fam_apple_ipad_pro', brandId: 'brand_apple', name: 'iPad Pro', deviceType: 'TABLET' },

  // Samsung
  { id: 'fam_samsung_s', brandId: 'brand_samsung', name: 'Galaxy S Series', deviceType: 'PHONE' },
  { id: 'fam_samsung_a', brandId: 'brand_samsung', name: 'Galaxy A Series', deviceType: 'PHONE' },
  { id: 'fam_samsung_note', brandId: 'brand_samsung', name: 'Galaxy Note Series', deviceType: 'PHONE' },
  { id: 'fam_samsung_z_fold', brandId: 'brand_samsung', name: 'Galaxy Z Fold', deviceType: 'PHONE' },
  { id: 'fam_samsung_z_flip', brandId: 'brand_samsung', name: 'Galaxy Z Flip', deviceType: 'PHONE' },
  { id: 'fam_samsung_m', brandId: 'brand_samsung', name: 'Galaxy M Series', deviceType: 'PHONE' },
  { id: 'fam_samsung_f', brandId: 'brand_samsung', name: 'Galaxy F Series', deviceType: 'PHONE' },
  { id: 'fam_samsung_xcover', brandId: 'brand_samsung', name: 'Galaxy XCover', deviceType: 'PHONE' },
  { id: 'fam_samsung_tab', brandId: 'brand_samsung', name: 'Galaxy Tab', deviceType: 'TABLET' },

  // Tecno
  { id: 'fam_tecno_camon', brandId: 'brand_tecno', name: 'Camon Series', deviceType: 'PHONE' },
  { id: 'fam_tecno_phantom', brandId: 'brand_tecno', name: 'Phantom Series', deviceType: 'PHONE' },
  { id: 'fam_tecno_spark', brandId: 'brand_tecno', name: 'Spark Series', deviceType: 'PHONE' },
  { id: 'fam_tecno_pop', brandId: 'brand_tecno', name: 'Pop Series', deviceType: 'PHONE' },
  { id: 'fam_tecno_pova', brandId: 'brand_tecno', name: 'Pova Series', deviceType: 'PHONE' },

  // Infinix
  { id: 'fam_infinix_note', brandId: 'brand_infinix', name: 'Note Series', deviceType: 'PHONE' },
  { id: 'fam_infinix_hot', brandId: 'brand_infinix', name: 'Hot Series', deviceType: 'PHONE' },
  { id: 'fam_infinix_zero', brandId: 'brand_infinix', name: 'Zero Series', deviceType: 'PHONE' },
  { id: 'fam_infinix_smart', brandId: 'brand_infinix', name: 'Smart Series', deviceType: 'PHONE' },
  { id: 'fam_infinix_gt', brandId: 'brand_infinix', name: 'GT Series', deviceType: 'PHONE' },

  // Xiaomi / Redmi / POCO
  { id: 'fam_xiaomi_flagship', brandId: 'brand_xiaomi', name: 'Xiaomi Series', deviceType: 'PHONE' },
  { id: 'fam_xiaomi_redmi_note', brandId: 'brand_xiaomi', name: 'Redmi Note Series', deviceType: 'PHONE' },
  { id: 'fam_xiaomi_redmi', brandId: 'brand_xiaomi', name: 'Redmi Series', deviceType: 'PHONE' },
  { id: 'fam_xiaomi_poco', brandId: 'brand_xiaomi', name: 'POCO Series', deviceType: 'PHONE' },
  { id: 'fam_xiaomi_pad', brandId: 'brand_xiaomi', name: 'Xiaomi Pad', deviceType: 'TABLET' },

  // Google
  { id: 'fam_google_pixel', brandId: 'brand_google', name: 'Pixel Standard / Pro', deviceType: 'PHONE' },
  { id: 'fam_google_pixel_a', brandId: 'brand_google', name: 'Pixel A Series', deviceType: 'PHONE' },
  { id: 'fam_google_pixel_fold', brandId: 'brand_google', name: 'Pixel Fold', deviceType: 'PHONE' },
  { id: 'fam_google_pixel_tab', brandId: 'brand_google', name: 'Pixel Tablet', deviceType: 'TABLET' },

  // OnePlus
  { id: 'fam_oneplus_numbered', brandId: 'brand_oneplus', name: 'Flagship Number Series', deviceType: 'PHONE' },
  { id: 'fam_oneplus_nord', brandId: 'brand_oneplus', name: 'Nord Series', deviceType: 'PHONE' },
  { id: 'fam_oneplus_open', brandId: 'brand_oneplus', name: 'Open Series', deviceType: 'PHONE' },
  { id: 'fam_oneplus_pad', brandId: 'brand_oneplus', name: 'OnePlus Pad', deviceType: 'TABLET' },

  // OPPO
  { id: 'fam_oppo_find', brandId: 'brand_oppo', name: 'Find Series', deviceType: 'PHONE' },
  { id: 'fam_oppo_reno', brandId: 'brand_oppo', name: 'Reno Series', deviceType: 'PHONE' },
  { id: 'fam_oppo_a', brandId: 'brand_oppo', name: 'A Series', deviceType: 'PHONE' },
  { id: 'fam_oppo_f', brandId: 'brand_oppo', name: 'F Series', deviceType: 'PHONE' },
  { id: 'fam_oppo_pad', brandId: 'brand_oppo', name: 'OPPO Pad', deviceType: 'TABLET' },

  // Vivo
  { id: 'fam_vivo_x', brandId: 'brand_vivo', name: 'X Series', deviceType: 'PHONE' },
  { id: 'fam_vivo_v', brandId: 'brand_vivo', name: 'V Series', deviceType: 'PHONE' },
  { id: 'fam_vivo_y', brandId: 'brand_vivo', name: 'Y Series', deviceType: 'PHONE' },
  { id: 'fam_vivo_t', brandId: 'brand_vivo', name: 'T Series', deviceType: 'PHONE' },
  { id: 'fam_vivo_pad', brandId: 'brand_vivo', name: 'Vivo Pad', deviceType: 'TABLET' },

  // Huawei
  { id: 'fam_huawei_p', brandId: 'brand_huawei', name: 'P / Pura Series', deviceType: 'PHONE' },
  { id: 'fam_huawei_mate', brandId: 'brand_huawei', name: 'Mate Series', deviceType: 'PHONE' },
  { id: 'fam_huawei_nova', brandId: 'brand_huawei', name: 'Nova Series', deviceType: 'PHONE' },
  { id: 'fam_huawei_y', brandId: 'brand_huawei', name: 'Y Series', deviceType: 'PHONE' },
  { id: 'fam_huawei_pad', brandId: 'brand_huawei', name: 'MatePad Series', deviceType: 'TABLET' },

  // Motorola
  { id: 'fam_moto_g', brandId: 'brand_motorola', name: 'Moto G Series', deviceType: 'PHONE' },
  { id: 'fam_moto_edge', brandId: 'brand_motorola', name: 'Edge Series', deviceType: 'PHONE' },
  { id: 'fam_moto_razr', brandId: 'brand_motorola', name: 'Razr Foldable Series', deviceType: 'PHONE' },

  // Nokia
  { id: 'fam_nokia_g', brandId: 'brand_nokia', name: 'G Series', deviceType: 'PHONE' },
  { id: 'fam_nokia_x', brandId: 'brand_nokia', name: 'X Series', deviceType: 'PHONE' },
  { id: 'fam_nokia_c', brandId: 'brand_nokia', name: 'C Series', deviceType: 'PHONE' },

  // Realme
  { id: 'fam_realme_gt', brandId: 'brand_realme', name: 'GT Series', deviceType: 'PHONE' },
  { id: 'fam_realme_number', brandId: 'brand_realme', name: 'Number Series', deviceType: 'PHONE' },
  { id: 'fam_realme_c', brandId: 'brand_realme', name: 'C Series', deviceType: 'PHONE' },
  { id: 'fam_realme_narzo', brandId: 'brand_realme', name: 'Narzo Series', deviceType: 'PHONE' },
  { id: 'fam_realme_pad', brandId: 'brand_realme', name: 'Realme Pad', deviceType: 'TABLET' },

  // Sony
  { id: 'fam_sony_xperia', brandId: 'brand_sony', name: 'Xperia Series', deviceType: 'PHONE' },

  // ASUS
  { id: 'fam_asus_rog', brandId: 'brand_asus', name: 'ROG Phone', deviceType: 'PHONE' },
  { id: 'fam_asus_zenfone', brandId: 'brand_asus', name: 'Zenfone', deviceType: 'PHONE' },

  // Nothing
  { id: 'fam_nothing_phone', brandId: 'brand_nothing', name: 'Phone Series', deviceType: 'PHONE' },
];

const standardPhoneIssues = [
  'Screen Cracked / Broken Glass',
  'Screen Blank / Lines / Blackout',
  'Battery Drain / Swelling',
  'Charging Port Loose / Faulty',
  'Rear Camera / Lens Damaged',
  'Earpiece / Speaker Buzzing',
  'Water Damage Diagnostics',
];

const standardTabletIssues = [
  'Touch Glass Cracked / Digitizer',
  'LCD / OLED Display Replacement',
  'Battery Replacement',
  'USB-C / Lightning Port Repair',
  'Power / Volume Button Stuck',
  'Housing Bent / Frame Repair',
];

export const seedModels: DeviceModel[] = [
  /* =======================================================================
   * 1. APPLE IPHONE (2015/2016 – 2026)
   * ===================================================================== */
  // iPhone 6s & 7 series
  { id: 'model_ip6s', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 6s', releaseYear: 2015, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip6sp', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 6s Plus', releaseYear: 2015, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ipse1', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone SE (1st generation)', releaseYear: 2016, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip7', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 7', releaseYear: 2016, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip7p', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 7 Plus', releaseYear: 2016, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // iPhone 8 & X series (2017 - 2018)
  { id: 'model_ip8', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 8', releaseYear: 2017, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip8p', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 8 Plus', releaseYear: 2017, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ipx', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone X', releaseYear: 2017, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ipxr', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone XR', releaseYear: 2018, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ipxs', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone XS', releaseYear: 2018, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ipxsmax', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone XS Max', releaseYear: 2018, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // iPhone 11 series & SE 2nd Gen (2019 - 2020)
  { id: 'model_ip11', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 11', releaseYear: 2019, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip11pro', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 11 Pro', releaseYear: 2019, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip11promax', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 11 Pro Max', releaseYear: 2019, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ipse2', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone SE (2nd generation)', releaseYear: 2020, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },

  // iPhone 12 series (2020)
  { id: 'model_ip12mini', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 12 mini', releaseYear: 2020, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip12', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 12', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip12pro', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 12 Pro', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip12promax', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 12 Pro Max', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // iPhone 13 series & SE 3rd Gen (2021 - 2022)
  { id: 'model_ip13mini', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 13 mini', releaseYear: 2021, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip13', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 13', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip13pro', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 13 Pro', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip13promax', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 13 Pro Max', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ipse3', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone SE (3rd generation)', releaseYear: 2022, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },

  // iPhone 14 series (2022)
  { id: 'model_ip14', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 14', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip14plus', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 14 Plus', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip14pro', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 14 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip14promax', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 14 Pro Max', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // iPhone 15 series (2023)
  { id: 'model_ip15', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 15', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip15plus', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 15 Plus', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip15pro', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 15 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip15promax', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 15 Pro Max', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // iPhone 16 series & 16e (2024 - 2025)
  { id: 'model_ip16', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 16', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip16plus', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 16 Plus', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip16pro', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 16 Pro', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip16promax', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 16 Pro Max', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip16e', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 16e', releaseYear: 2025, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // iPhone 17 family & iPhone Air (2025 - 2026)
  { id: 'model_ip17', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 17', releaseYear: 2025, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip17air', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone Air (17 Slim)', releaseYear: 2025, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip17pro', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 17 Pro', releaseYear: 2025, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_ip17promax', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_iphone', familyName: 'iPhone', name: 'iPhone 17 Pro Max', releaseYear: 2025, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 2. APPLE IPAD (2016 – 2026)
   * ===================================================================== */
  // iPad Standard
  { id: 'model_ipad5', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad', familyName: 'iPad (Standard)', name: 'iPad 9.7-inch (5th generation)', releaseYear: 2017, deviceType: 'TABLET', isPopular: false, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipad6', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad', familyName: 'iPad (Standard)', name: 'iPad 9.7-inch (6th generation)', releaseYear: 2018, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipad7', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad', familyName: 'iPad (Standard)', name: 'iPad 10.2-inch (7th generation)', releaseYear: 2019, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipad8', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad', familyName: 'iPad (Standard)', name: 'iPad 10.2-inch (8th generation)', releaseYear: 2020, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipad9', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad', familyName: 'iPad (Standard)', name: 'iPad 10.2-inch (9th generation)', releaseYear: 2021, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipad10', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad', familyName: 'iPad (Standard)', name: 'iPad 10.9-inch (10th generation)', releaseYear: 2022, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipad11', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad', familyName: 'iPad (Standard)', name: 'iPad 10.9-inch (11th generation)', releaseYear: 2024, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  // iPad mini
  { id: 'model_ipadmini4', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_mini', familyName: 'iPad mini', name: 'iPad mini 4', releaseYear: 2015, deviceType: 'TABLET', isPopular: false, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadmini5', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_mini', familyName: 'iPad mini', name: 'iPad mini (5th generation)', releaseYear: 2019, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadmini6', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_mini', familyName: 'iPad mini', name: 'iPad mini (6th generation)', releaseYear: 2021, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadmini7', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_mini', familyName: 'iPad mini', name: 'iPad mini (7th gen / A17 Pro)', releaseYear: 2024, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  // iPad Air
  { id: 'model_ipadair2', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_air', familyName: 'iPad Air', name: 'iPad Air 2', releaseYear: 2014, deviceType: 'TABLET', isPopular: false, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadair3', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_air', familyName: 'iPad Air', name: 'iPad Air 10.5-inch (3rd generation)', releaseYear: 2019, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadair4', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_air', familyName: 'iPad Air', name: 'iPad Air 10.9-inch (4th generation)', releaseYear: 2020, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadair5', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_air', familyName: 'iPad Air', name: 'iPad Air 10.9-inch (5th generation / M1)', releaseYear: 2022, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadair6_11', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_air', familyName: 'iPad Air', name: 'iPad Air 11-inch (M2)', releaseYear: 2024, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadair6_13', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_air', familyName: 'iPad Air', name: 'iPad Air 13-inch (M2)', releaseYear: 2024, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  // iPad Pro
  { id: 'model_ipadpro97', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 9.7-inch', releaseYear: 2016, deviceType: 'TABLET', isPopular: false, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro105', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 10.5-inch', releaseYear: 2017, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro129_2', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 12.9-inch (2nd generation)', releaseYear: 2017, deviceType: 'TABLET', isPopular: false, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro11_1', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 11-inch (1st generation)', releaseYear: 2018, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro129_3', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 12.9-inch (3rd generation)', releaseYear: 2018, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro11_2', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 11-inch (2nd generation)', releaseYear: 2020, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro129_4', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 12.9-inch (4th generation)', releaseYear: 2020, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro11_3', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 11-inch (3rd generation / M1)', releaseYear: 2021, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro129_5', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 12.9-inch (5th generation / M1)', releaseYear: 2021, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro11_4', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 11-inch (4th generation / M2)', releaseYear: 2022, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro129_6', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 12.9-inch (6th generation / M2)', releaseYear: 2022, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro11_m4', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 11-inch (M4 Ultra Retina OLED)', releaseYear: 2024, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_ipadpro13_m4', brandId: 'brand_apple', brandName: 'Apple', familyId: 'fam_apple_ipad_pro', familyName: 'iPad Pro', name: 'iPad Pro 13-inch (M4 Ultra Retina OLED)', releaseYear: 2024, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  /* =======================================================================
   * 3. SAMSUNG (2016 – 2026)
   * ===================================================================== */
  // Galaxy S Series
  { id: 'model_sams7', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S7 / S7 Edge', releaseYear: 2016, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams8', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S8 / S8+', releaseYear: 2017, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams9', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S9 / S9+', releaseYear: 2018, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams10', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S10 / S10+ / S10e', releaseYear: 2019, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams20', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S20 / S20+ / S20 Ultra', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams20fe', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S20 FE', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams21', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S21 / S21+ / S21 Ultra', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams21fe', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S21 FE', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams22', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S22', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams22u', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S22 Ultra', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams23', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S23 / S23+', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams23u', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S23 Ultra', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams23fe', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S23 FE', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams24', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S24 / S24+', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams24u', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S24 Ultra', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams24fe', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S24 FE', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams25u', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S25 Ultra', releaseYear: 2025, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sams25', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_s', familyName: 'Galaxy S Series', name: 'Galaxy S25 / S25+', releaseYear: 2025, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // Galaxy A Series (Widely popular in Nigeria)
  { id: 'model_sama10', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A10 / A10s', releaseYear: 2019, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama12', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A12', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama13', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A13', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama14', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A14', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama15', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A15 4G / 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama16', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A16 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama20', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A20 / A20s', releaseYear: 2019, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama23', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A23', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama24', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A24', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama25', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A25 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama32', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A32', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama34', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A34 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama35', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A35 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama50', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A50 / A50s', releaseYear: 2019, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama51', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A51', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama52', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A52 / A52s 5G', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama53', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A53 5G', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama54', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A54 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama55', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A55 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama71', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A71', releaseYear: 2020, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sama73', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_a', familyName: 'Galaxy A Series', name: 'Galaxy A73 5G', releaseYear: 2022, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },

  // Galaxy Note
  { id: 'model_samnote8', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_note', familyName: 'Galaxy Note Series', name: 'Galaxy Note 8', releaseYear: 2017, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samnote9', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_note', familyName: 'Galaxy Note Series', name: 'Galaxy Note 9', releaseYear: 2018, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samnote10', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_note', familyName: 'Galaxy Note Series', name: 'Galaxy Note 10 / 10+', releaseYear: 2019, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samnote20', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_note', familyName: 'Galaxy Note Series', name: 'Galaxy Note 20', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samnote20u', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_note', familyName: 'Galaxy Note Series', name: 'Galaxy Note 20 Ultra', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // Galaxy Foldables
  { id: 'model_samzfold2', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_fold', familyName: 'Galaxy Z Fold', name: 'Galaxy Z Fold 2', releaseYear: 2020, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samzfold3', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_fold', familyName: 'Galaxy Z Fold', name: 'Galaxy Z Fold 3', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samzfold4', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_fold', familyName: 'Galaxy Z Fold', name: 'Galaxy Z Fold 4', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samzfold5', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_fold', familyName: 'Galaxy Z Fold', name: 'Galaxy Z Fold 5', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samzfold6', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_fold', familyName: 'Galaxy Z Fold', name: 'Galaxy Z Fold 6', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samzflip3', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_flip', familyName: 'Galaxy Z Flip', name: 'Galaxy Z Flip 3', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samzflip4', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_flip', familyName: 'Galaxy Z Flip', name: 'Galaxy Z Flip 4', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samzflip5', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_flip', familyName: 'Galaxy Z Flip', name: 'Galaxy Z Flip 5', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samzflip6', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_z_flip', familyName: 'Galaxy Z Flip', name: 'Galaxy Z Flip 6', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // Galaxy M, F, XCover
  { id: 'model_samm14', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_m', familyName: 'Galaxy M Series', name: 'Galaxy M14 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samm34', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_m', familyName: 'Galaxy M Series', name: 'Galaxy M34 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samm54', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_m', familyName: 'Galaxy M Series', name: 'Galaxy M54 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samf54', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_f', familyName: 'Galaxy F Series', name: 'Galaxy F54', releaseYear: 2023, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samxcover6', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_xcover', familyName: 'Galaxy XCover', name: 'Galaxy XCover 6 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_samxcover7', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_xcover', familyName: 'Galaxy XCover', name: 'Galaxy XCover 7', releaseYear: 2024, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },

  // Galaxy Tab (Tablet)
  { id: 'model_samtaba7', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_tab', familyName: 'Galaxy Tab', name: 'Galaxy Tab A7 / A7 Lite', releaseYear: 2020, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_samtaba8', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_tab', familyName: 'Galaxy Tab', name: 'Galaxy Tab A8 10.5', releaseYear: 2022, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_samtaba9', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_tab', familyName: 'Galaxy Tab', name: 'Galaxy Tab A9 / A9+', releaseYear: 2023, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_samtabs6lite', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_tab', familyName: 'Galaxy Tab', name: 'Galaxy Tab S6 Lite', releaseYear: 2020, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_samtabs7', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_tab', familyName: 'Galaxy Tab', name: 'Galaxy Tab S7 / S7+', releaseYear: 2020, deviceType: 'TABLET', isPopular: false, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_samtabs8', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_tab', familyName: 'Galaxy Tab', name: 'Galaxy Tab S8 / S8+ / S8 Ultra', releaseYear: 2022, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_samtabs9', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_tab', familyName: 'Galaxy Tab', name: 'Galaxy Tab S9 / S9 FE / S9 Ultra', releaseYear: 2023, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },
  { id: 'model_samtabs10', brandId: 'brand_samsung', brandName: 'Samsung', familyId: 'fam_samsung_tab', familyName: 'Galaxy Tab', name: 'Galaxy Tab S10+ / S10 Ultra', releaseYear: 2024, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  /* =======================================================================
   * 4. TECNO (Nigeria Top Tier)
   * ===================================================================== */
  // Camon
  { id: 'model_tecnocamon17', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_camon', familyName: 'Camon Series', name: 'Tecno Camon 17 / 17 Pro', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnocamon18', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_camon', familyName: 'Camon Series', name: 'Tecno Camon 18 / 18 Premier', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnocamon19', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_camon', familyName: 'Camon Series', name: 'Tecno Camon 19 / 19 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnocamon20', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_camon', familyName: 'Camon Series', name: 'Tecno Camon 20 / 20 Pro / 20 Premier', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnocamon30', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_camon', familyName: 'Camon Series', name: 'Tecno Camon 30 / 30 Pro 5G / 30 Premier', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // Phantom
  { id: 'model_tecnophantomx', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_phantom', familyName: 'Phantom Series', name: 'Tecno Phantom X', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnophantomx2', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_phantom', familyName: 'Phantom Series', name: 'Tecno Phantom X2 / X2 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnophantomvfold', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_phantom', familyName: 'Phantom Series', name: 'Tecno Phantom V Fold / V Flip', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnophantomvfold2', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_phantom', familyName: 'Phantom Series', name: 'Tecno Phantom V Fold2 / V Flip2', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // Spark
  { id: 'model_tecnospark8', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_spark', familyName: 'Spark Series', name: 'Tecno Spark 8 / 8P', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnospark9', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_spark', familyName: 'Spark Series', name: 'Tecno Spark 9 / 9 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnospark10', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_spark', familyName: 'Spark Series', name: 'Tecno Spark 10 / 10 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnospark20', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_spark', familyName: 'Spark Series', name: 'Tecno Spark 20 / 20 Pro / 20 Pro+', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnospark30', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_spark', familyName: 'Spark Series', name: 'Tecno Spark 30 / 30 Pro', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // Pop & Pova
  { id: 'model_tecnopop7', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_pop', familyName: 'Pop Series', name: 'Tecno Pop 7 / 7 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnopop8', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_pop', familyName: 'Pop Series', name: 'Tecno Pop 8', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnopop9', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_pop', familyName: 'Pop Series', name: 'Tecno Pop 9 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnopova5', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_pova', familyName: 'Pova Series', name: 'Tecno Pova 5 / 5 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_tecnopova6', brandId: 'brand_tecno', brandName: 'Tecno', familyId: 'fam_tecno_pova', familyName: 'Pova Series', name: 'Tecno Pova 6 / 6 Pro 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 5. INFINIX (Nigeria Top Tier)
   * ===================================================================== */
  // Note Series
  { id: 'model_infinixnote11', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_note', familyName: 'Note Series', name: 'Infinix Note 11 / 11 Pro', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixnote12', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_note', familyName: 'Note Series', name: 'Infinix Note 12 / 12 VIP', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixnote30', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_note', familyName: 'Note Series', name: 'Infinix Note 30 / 30 Pro / 30 VIP', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixnote40', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_note', familyName: 'Note Series', name: 'Infinix Note 40 / 40 Pro / 40 Pro+ 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // Hot Series
  { id: 'model_infinixhot11', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_hot', familyName: 'Hot Series', name: 'Infinix Hot 11 / 11 Play', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixhot12', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_hot', familyName: 'Hot Series', name: 'Infinix Hot 12 / 12 Play / 12i', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixhot20', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_hot', familyName: 'Hot Series', name: 'Infinix Hot 20 / 20i / 20 Play', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixhot30', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_hot', familyName: 'Hot Series', name: 'Infinix Hot 30 / 30i / 30 Play', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixhot40', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_hot', familyName: 'Hot Series', name: 'Infinix Hot 40 / 40i / 40 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixhot50', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_hot', familyName: 'Hot Series', name: 'Infinix Hot 50 / 50 Pro+ 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  // Zero & Smart & GT
  { id: 'model_infinixzero20', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_zero', familyName: 'Zero Series', name: 'Infinix Zero 20', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixzero30', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_zero', familyName: 'Zero Series', name: 'Infinix Zero 30 4G / 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixzeroflip', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_zero', familyName: 'Zero Series', name: 'Infinix Zero Flip', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixsmart7', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_smart', familyName: 'Smart Series', name: 'Infinix Smart 7 / 7 HD', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixsmart8', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_smart', familyName: 'Smart Series', name: 'Infinix Smart 8 / 8 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixsmart9', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_smart', familyName: 'Smart Series', name: 'Infinix Smart 9', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixgt10pro', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_gt', familyName: 'GT Series', name: 'Infinix GT 10 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_infinixgt20pro', brandId: 'brand_infinix', brandName: 'Infinix', familyId: 'fam_infinix_gt', familyName: 'GT Series', name: 'Infinix GT 20 Pro', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 6. XIAOMI / REDMI / POCO
   * ===================================================================== */
  { id: 'model_xiaomi12', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_flagship', familyName: 'Xiaomi Series', name: 'Xiaomi 12 / 12 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_xiaomi13', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_flagship', familyName: 'Xiaomi Series', name: 'Xiaomi 13 / 13 Pro / 13 Ultra', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_xiaomi14', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_flagship', familyName: 'Xiaomi Series', name: 'Xiaomi 14 / 14 Ultra', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_xiaomi15', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_flagship', familyName: 'Xiaomi Series', name: 'Xiaomi 15 / 15 Pro', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redminote10', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi_note', familyName: 'Redmi Note Series', name: 'Redmi Note 10 / 10 Pro', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redminote11', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi_note', familyName: 'Redmi Note Series', name: 'Redmi Note 11 / 11 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redminote12', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi_note', familyName: 'Redmi Note Series', name: 'Redmi Note 12 / 12 Pro 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redminote13', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi_note', familyName: 'Redmi Note Series', name: 'Redmi Note 13 / 13 Pro / 13 Pro+ 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redminote14', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi_note', familyName: 'Redmi Note Series', name: 'Redmi Note 14 / 14 Pro+ 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redmi10', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi', familyName: 'Redmi Series', name: 'Redmi 10 / 10C', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redmi12', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi', familyName: 'Redmi Series', name: 'Redmi 12 / 12 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redmi13c', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi', familyName: 'Redmi Series', name: 'Redmi 13C', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_redmi14c', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_redmi', familyName: 'Redmi Series', name: 'Redmi 14C', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pocox3pro', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_poco', familyName: 'POCO Series', name: 'POCO X3 Pro', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pocox5pro', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_poco', familyName: 'POCO Series', name: 'POCO X5 Pro 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pocox6pro', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_poco', familyName: 'POCO Series', name: 'POCO X6 Pro 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pocof5', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_poco', familyName: 'POCO Series', name: 'POCO F5 / F5 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pocof6', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_poco', familyName: 'POCO Series', name: 'POCO F6 / F6 Pro', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_xiaomipad6', brandId: 'brand_xiaomi', brandName: 'Xiaomi / Redmi', familyId: 'fam_xiaomi_pad', familyName: 'Xiaomi Pad', name: 'Xiaomi Pad 6 / Pad 6 Pro', releaseYear: 2023, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  /* =======================================================================
   * 7. GOOGLE PIXEL
   * ===================================================================== */
  { id: 'model_pixel3', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel', familyName: 'Pixel Standard / Pro', name: 'Pixel 3 / 3 XL', releaseYear: 2018, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel4', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel', familyName: 'Pixel Standard / Pro', name: 'Pixel 4 / 4 XL', releaseYear: 2019, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel5', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel', familyName: 'Pixel Standard / Pro', name: 'Pixel 5', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel6', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel', familyName: 'Pixel Standard / Pro', name: 'Pixel 6 / 6 Pro', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel7', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel', familyName: 'Pixel Standard / Pro', name: 'Pixel 7 / 7 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel8', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel', familyName: 'Pixel Standard / Pro', name: 'Pixel 8 / 8 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel9', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel', familyName: 'Pixel Standard / Pro', name: 'Pixel 9 / 9 Pro / 9 Pro XL', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel4a', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel_a', familyName: 'Pixel A Series', name: 'Pixel 4a / 4a 5G', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel6a', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel_a', familyName: 'Pixel A Series', name: 'Pixel 6a', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel7a', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel_a', familyName: 'Pixel A Series', name: 'Pixel 7a', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel8a', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel_a', familyName: 'Pixel A Series', name: 'Pixel 8a', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixelfold', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel_fold', familyName: 'Pixel Fold', name: 'Pixel Fold', releaseYear: 2023, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixel9profold', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel_fold', familyName: 'Pixel Fold', name: 'Pixel 9 Pro Fold', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_pixeltab', brandId: 'brand_google', brandName: 'Google Pixel', familyId: 'fam_google_pixel_tab', familyName: 'Pixel Tablet', name: 'Google Pixel Tablet', releaseYear: 2023, deviceType: 'TABLET', isPopular: false, isActive: true, commonIssues: standardTabletIssues },

  /* =======================================================================
   * 8. ONEPLUS
   * ===================================================================== */
  { id: 'model_op7', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_numbered', familyName: 'Flagship Number Series', name: 'OnePlus 7 / 7 Pro', releaseYear: 2019, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_op8', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_numbered', familyName: 'Flagship Number Series', name: 'OnePlus 8 / 8 Pro / 8T', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_op9', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_numbered', familyName: 'Flagship Number Series', name: 'OnePlus 9 / 9 Pro', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_op10pro', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_numbered', familyName: 'Flagship Number Series', name: 'OnePlus 10 Pro / 10T', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_op11', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_numbered', familyName: 'Flagship Number Series', name: 'OnePlus 11', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_op12', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_numbered', familyName: 'Flagship Number Series', name: 'OnePlus 12 / 12R', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_op13', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_numbered', familyName: 'Flagship Number Series', name: 'OnePlus 13 / 13R', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_opnord2', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_nord', familyName: 'Nord Series', name: 'OnePlus Nord 2 / 2T', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_opnord3', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_nord', familyName: 'Nord Series', name: 'OnePlus Nord 3 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_opnord4', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_nord', familyName: 'Nord Series', name: 'OnePlus Nord 4', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_opopen', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_open', familyName: 'Open Series', name: 'OnePlus Open', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_oppad', brandId: 'brand_oneplus', brandName: 'OnePlus', familyId: 'fam_oneplus_pad', familyName: 'OnePlus Pad', name: 'OnePlus Pad / Pad 2', releaseYear: 2024, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  /* =======================================================================
   * 9. OPPO
   * ===================================================================== */
  { id: 'model_oppofindx5', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_find', familyName: 'Find Series', name: 'OPPO Find X5 / X5 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_oppofindx7', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_find', familyName: 'Find Series', name: 'OPPO Find X7 / X7 Ultra', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_oppofindn3', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_find', familyName: 'Find Series', name: 'OPPO Find N3 / N3 Flip', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_opporeno8', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_reno', familyName: 'Reno Series', name: 'OPPO Reno 8 / 8 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_opporeno10', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_reno', familyName: 'Reno Series', name: 'OPPO Reno 10 / 10 Pro 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_opporeno12', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_reno', familyName: 'Reno Series', name: 'OPPO Reno 12 / 12 Pro 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_oppoa57', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_a', familyName: 'A Series', name: 'OPPO A57 / A58', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_oppoa78', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_a', familyName: 'A Series', name: 'OPPO A78 / A79 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_oppof21pro', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_f', familyName: 'F Series', name: 'OPPO F21 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_oppof25pro', brandId: 'brand_oppo', brandName: 'OPPO', familyId: 'fam_oppo_f', familyName: 'F Series', name: 'OPPO F25 Pro 5G', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 10. VIVO
   * ===================================================================== */
  { id: 'model_vivox80', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_x', familyName: 'X Series', name: 'Vivo X80 / X80 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_vivox90', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_x', familyName: 'X Series', name: 'Vivo X90 / X90 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_vivox100', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_x', familyName: 'X Series', name: 'Vivo X100 / X100 Pro / X100 Ultra', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_vivov27', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_v', familyName: 'V Series', name: 'Vivo V27 / V27e', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_vivov29', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_v', familyName: 'V Series', name: 'Vivo V29 / V29e', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_vivov30', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_v', familyName: 'V Series', name: 'Vivo V30 / V30 Pro', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_vivov40', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_v', familyName: 'V Series', name: 'Vivo V40 / V40 Pro', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_vivoy22', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_y', familyName: 'Y Series', name: 'Vivo Y22 / Y35', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_vivoy36', brandId: 'brand_vivo', brandName: 'Vivo', familyId: 'fam_vivo_y', familyName: 'Y Series', name: 'Vivo Y36 / Y100', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 11. HUAWEI
   * ===================================================================== */
  { id: 'model_huap30', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_p', familyName: 'P / Pura Series', name: 'Huawei P30 / P30 Pro', releaseYear: 2019, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huap40', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_p', familyName: 'P / Pura Series', name: 'Huawei P40 / P40 Pro', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huap50', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_p', familyName: 'P / Pura Series', name: 'Huawei P50 / P50 Pro', releaseYear: 2021, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huap60', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_p', familyName: 'P / Pura Series', name: 'Huawei P60 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huapura70', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_p', familyName: 'P / Pura Series', name: 'Huawei Pura 70 / 70 Pro / 70 Ultra', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huamate30', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_mate', familyName: 'Mate Series', name: 'Huawei Mate 30 / 30 Pro', releaseYear: 2019, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huamate40', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_mate', familyName: 'Mate Series', name: 'Huawei Mate 40 Pro', releaseYear: 2020, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huamate50', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_mate', familyName: 'Mate Series', name: 'Huawei Mate 50 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huamate60', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_mate', familyName: 'Mate Series', name: 'Huawei Mate 60 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huanova9', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_nova', familyName: 'Nova Series', name: 'Huawei Nova 9 / 10 / 11', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_huamatepad11', brandId: 'brand_huawei', brandName: 'Huawei', familyId: 'fam_huawei_pad', familyName: 'MatePad Series', name: 'Huawei MatePad 11 / MatePad Pro', releaseYear: 2023, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  /* =======================================================================
   * 12. MOTOROLA
   * ===================================================================== */
  { id: 'model_motog54', brandId: 'brand_motorola', brandName: 'Motorola', familyId: 'fam_moto_g', familyName: 'Moto G Series', name: 'Moto G54 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_motog84', brandId: 'brand_motorola', brandName: 'Motorola', familyId: 'fam_moto_g', familyName: 'Moto G Series', name: 'Moto G84 5G', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_motoedge30', brandId: 'brand_motorola', brandName: 'Motorola', familyId: 'fam_moto_edge', familyName: 'Edge Series', name: 'Motorola Edge 30 / 30 Ultra', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_motoedge40', brandId: 'brand_motorola', brandName: 'Motorola', familyId: 'fam_moto_edge', familyName: 'Edge Series', name: 'Motorola Edge 40 / 40 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_motoedge50', brandId: 'brand_motorola', brandName: 'Motorola', familyId: 'fam_moto_edge', familyName: 'Edge Series', name: 'Motorola Edge 50 Pro / 50 Ultra', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_motorazr40', brandId: 'brand_motorola', brandName: 'Motorola', familyId: 'fam_moto_razr', familyName: 'Razr Foldable Series', name: 'Motorola Razr 40 / 40 Ultra', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_motorazr50', brandId: 'brand_motorola', brandName: 'Motorola', familyId: 'fam_moto_razr', familyName: 'Razr Foldable Series', name: 'Motorola Razr 50 / 50 Ultra', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 13. NOKIA
   * ===================================================================== */
  { id: 'model_nokiag20', brandId: 'brand_nokia', brandName: 'Nokia', familyId: 'fam_nokia_g', familyName: 'G Series', name: 'Nokia G20 / G21', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_nokiag42', brandId: 'brand_nokia', brandName: 'Nokia', familyId: 'fam_nokia_g', familyName: 'G Series', name: 'Nokia G42 5G (QuickFix)', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_nokiax20', brandId: 'brand_nokia', brandName: 'Nokia', familyId: 'fam_nokia_x', familyName: 'X Series', name: 'Nokia X20 / X30 5G', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_nokiac21', brandId: 'brand_nokia', brandName: 'Nokia', familyId: 'fam_nokia_c', familyName: 'C Series', name: 'Nokia C21 / C31 / C32', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 14. REALME
   * ===================================================================== */
  { id: 'model_realmegtneo3', brandId: 'brand_realme', brandName: 'Realme', familyId: 'fam_realme_gt', familyName: 'GT Series', name: 'Realme GT Neo 3 / Neo 5', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_realmegt6', brandId: 'brand_realme', brandName: 'Realme', familyId: 'fam_realme_gt', familyName: 'GT Series', name: 'Realme GT 6 / 6T', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_realme11pro', brandId: 'brand_realme', brandName: 'Realme', familyId: 'fam_realme_number', familyName: 'Number Series', name: 'Realme 11 Pro / 11 Pro+', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_realme12pro', brandId: 'brand_realme', brandName: 'Realme', familyId: 'fam_realme_number', familyName: 'Number Series', name: 'Realme 12 Pro / 12 Pro+', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_realmec53', brandId: 'brand_realme', brandName: 'Realme', familyId: 'fam_realme_c', familyName: 'C Series', name: 'Realme C53 / C55', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_realmec67', brandId: 'brand_realme', brandName: 'Realme', familyId: 'fam_realme_c', familyName: 'C Series', name: 'Realme C67', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_realmenarzo60', brandId: 'brand_realme', brandName: 'Realme', familyId: 'fam_realme_narzo', familyName: 'Narzo Series', name: 'Realme Narzo 60 / 70 Pro', releaseYear: 2023, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_realmepad', brandId: 'brand_realme', brandName: 'Realme', familyId: 'fam_realme_pad', familyName: 'Realme Pad', name: 'Realme Pad / Pad 2', releaseYear: 2023, deviceType: 'TABLET', isPopular: true, isActive: true, commonIssues: standardTabletIssues },

  /* =======================================================================
   * 15. SONY
   * ===================================================================== */
  { id: 'model_sonyxperia1_3', brandId: 'brand_sony', brandName: 'Sony', familyId: 'fam_sony_xperia', familyName: 'Xperia Series', name: 'Sony Xperia 1 III / 5 III', releaseYear: 2021, deviceType: 'PHONE', isPopular: false, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sonyxperia1_4', brandId: 'brand_sony', brandName: 'Sony', familyId: 'fam_sony_xperia', familyName: 'Xperia Series', name: 'Sony Xperia 1 IV / 5 IV', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sonyxperia1_5', brandId: 'brand_sony', brandName: 'Sony', familyId: 'fam_sony_xperia', familyName: 'Xperia Series', name: 'Sony Xperia 1 V / 5 V', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_sonyxperia1_6', brandId: 'brand_sony', brandName: 'Sony', familyId: 'fam_sony_xperia', familyName: 'Xperia Series', name: 'Sony Xperia 1 VI / 10 VI', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 16. ASUS
   * ===================================================================== */
  { id: 'model_asusrog6', brandId: 'brand_asus', brandName: 'ASUS', familyId: 'fam_asus_rog', familyName: 'ROG Phone', name: 'ASUS ROG Phone 6 / 6 Pro', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_asusrog7', brandId: 'brand_asus', brandName: 'ASUS', familyId: 'fam_asus_rog', familyName: 'ROG Phone', name: 'ASUS ROG Phone 7 / 7 Ultimate', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_asusrog8', brandId: 'brand_asus', brandName: 'ASUS', familyId: 'fam_asus_rog', familyName: 'ROG Phone', name: 'ASUS ROG Phone 8 / 8 Pro', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_asuszen10', brandId: 'brand_asus', brandName: 'ASUS', familyId: 'fam_asus_zenfone', familyName: 'Zenfone', name: 'ASUS Zenfone 10', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_asuszen11', brandId: 'brand_asus', brandName: 'ASUS', familyId: 'fam_asus_zenfone', familyName: 'Zenfone', name: 'ASUS Zenfone 11 Ultra', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },

  /* =======================================================================
   * 17. NOTHING
   * ===================================================================== */
  { id: 'model_nothingphone1', brandId: 'brand_nothing', brandName: 'Nothing', familyId: 'fam_nothing_phone', familyName: 'Phone Series', name: 'Nothing Phone (1)', releaseYear: 2022, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_nothingphone2', brandId: 'brand_nothing', brandName: 'Nothing', familyId: 'fam_nothing_phone', familyName: 'Phone Series', name: 'Nothing Phone (2)', releaseYear: 2023, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_nothingphone2a', brandId: 'brand_nothing', brandName: 'Nothing', familyId: 'fam_nothing_phone', familyName: 'Phone Series', name: 'Nothing Phone (2a)', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
  { id: 'model_nothingphone2aplus', brandId: 'brand_nothing', brandName: 'Nothing', familyId: 'fam_nothing_phone', familyName: 'Phone Series', name: 'Nothing Phone (2a) Plus', releaseYear: 2024, deviceType: 'PHONE', isPopular: true, isActive: true, commonIssues: standardPhoneIssues },
];
