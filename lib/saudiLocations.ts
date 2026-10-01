// =======================================================
// SAUDI ARABIA LOCATIONS DATABASE
// All 13 Administrative Regions, Major Cities & Districts
// =======================================================

export interface District {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  sourceIds?: string[];
}

export interface City {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  sourceIds?: string[];
  districts: District[];
}

export interface Region {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cities: City[];
}

export interface CustomLocation {
  id: string;
  region_name: string;
  city_name: string | null;
  district_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LocationOverride {
  source_id: string;
  new_name: string | null;
  is_deleted: boolean;
}

interface MunicipalityCity {
  city_id: number;
  region_id: number;
  name_ar: string;
}

interface MunicipalityDistrict {
  district_id: number;
  city_id: number;
  name_ar: string;
}

const municipalityCities = require('@/data/saudi-locations/cities.json') as MunicipalityCity[];
const municipalityDistricts = require('@/data/saudi-locations/districts.json') as MunicipalityDistrict[];
const regionKeyByMunicipalityId: Record<number, string> = {
  1: 'riyadh', 2: 'makkah', 3: 'madinah', 4: 'qassim', 5: 'eastern', 6: 'asir',
  7: 'tabuk', 8: 'hail', 9: 'northern_borders', 10: 'jazan', 11: 'najran', 12: 'baha', 13: 'jouf',
};

export function normalizeSaudiLocationName(value: string): string {
  return value
    .trim()
    .replace(/^(مدينة|حي|منطقة)\s+/u, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ar');
}

function districtDisplayName(name: string): string {
  const cleanName = name.trim();
  return /^حي\s+/u.test(cleanName) ? cleanName : `حي ${cleanName}`;
}

export function buildSaudiLocations(customLocations: CustomLocation[] = [], overrides: LocationOverride[] = []): Region[] {
  const regions = SAUDI_REGIONS.map(region => ({
    ...region,
    cities: region.cities.map(city => ({ ...city, districts: [...city.districts] })),
  }));
  const overrideBySourceId = new Map(overrides.map(override => [override.source_id, override]));
  regions.forEach(region => {
    const override = overrideBySourceId.get(`location:${region.id}`);
    if (override && !override.is_deleted && override.new_name) region.name = override.new_name;
  });
  const regionById = new Map(regions.map(region => [region.id, region]));
  const citiesByMunicipalityId = new Map<number, City>();
  const staticCityByKey = new Map<string, City>();

  regions.forEach(region => region.cities.forEach(city => {
    staticCityByKey.set(`${region.id}:${normalizeSaudiLocationName(city.name)}`, city);
  }));

  municipalityCities.forEach(cityRecord => {
    const region = regionById.get(regionKeyByMunicipalityId[cityRecord.region_id]);
    if (!region) return;

    const nameKey = `${region.id}:${normalizeSaudiLocationName(cityRecord.name_ar)}`;
    let city = staticCityByKey.get(nameKey);
    if (!city) {
      city = {
        id: `municipality-city-${cityRecord.city_id}`,
        name: cityRecord.name_ar,
        sourceIds: [],
        districts: [],
      };
      region.cities.push(city);
      staticCityByKey.set(nameKey, city);
    }
    city.sourceIds = [...(city.sourceIds || []), `municipality-city-${cityRecord.city_id}`];
    citiesByMunicipalityId.set(cityRecord.city_id, city);
  });

  municipalityDistricts.forEach(districtRecord => {
    const city = citiesByMunicipalityId.get(districtRecord.city_id);
    if (!city) return;
    const nameKey = normalizeSaudiLocationName(districtRecord.name_ar);
    const existing = city.districts.find(district => normalizeSaudiLocationName(district.name) === nameKey);
    if (existing) {
      existing.sourceIds = [...(existing.sourceIds || []), `municipality-district-${districtRecord.district_id}`];
      return;
    }
    city.districts.push({
      id: `municipality-district-${districtRecord.district_id}`,
      name: districtDisplayName(districtRecord.name_ar),
      sourceIds: [`municipality-district-${districtRecord.district_id}`],
    });
  });

  const applyOverride = (id: string, sourceIds: string[] | undefined, currentName: string) => {
    const override = [id, ...(sourceIds || [])].map(sourceId => overrideBySourceId.get(`location:${sourceId}`)).find(Boolean);
    return { deleted: override?.is_deleted || false, name: override && !override.is_deleted ? override.new_name || currentName : currentName };
  };
  regions.forEach(region => {
    region.cities = region.cities.filter(city => {
      const result = applyOverride(city.id, city.sourceIds, city.name);
      city.name = result.name;
      city.districts = city.districts.filter(district => {
        const districtResult = applyOverride(district.id, district.sourceIds, district.name);
        district.name = districtResult.name;
        return !districtResult.deleted;
      });
      return !result.deleted;
    });
  });

  customLocations.forEach(location => {
    const regionNameKey = normalizeSaudiLocationName(location.region_name);
    let region = regions.find(item => normalizeSaudiLocationName(item.name) === regionNameKey);
    if (!region) {
      const newRegion: Region = {
        id: `custom-region-${location.id}`,
        name: location.region_name.trim(),
        lat: location.latitude ?? 0,
        lng: location.longitude ?? 0,
        cities: [],
      };
      regions.push(newRegion);
      region = newRegion;
    } else if (location.city_name === null && location.latitude !== null && location.longitude !== null) {
      region.lat = location.latitude;
      region.lng = location.longitude;
    }

    if (!location.city_name) return;
    const cityNameKey = normalizeSaudiLocationName(location.city_name);
    let city = region.cities.find(item => normalizeSaudiLocationName(item.name) === cityNameKey);
    if (!city) {
      const newCity: City = {
        id: `custom-city-${location.id}`,
        name: location.city_name.trim(),
        lat: location.latitude ?? undefined,
        lng: location.longitude ?? undefined,
        districts: [],
      };
      region.cities.push(newCity);
      city = newCity;
    } else if (!location.district_name && location.latitude !== null && location.longitude !== null) {
      city.lat = location.latitude;
      city.lng = location.longitude;
    }

    if (!location.district_name) return;
    const districtKey = normalizeSaudiLocationName(location.district_name);
    const existingDistrict = city.districts.find(item => normalizeSaudiLocationName(item.name) === districtKey);
    if (!existingDistrict) {
      city.districts.push({
        id: `custom-district-${location.id}`,
        name: districtDisplayName(location.district_name),
        lat: location.latitude ?? undefined,
        lng: location.longitude ?? undefined,
      });
    } else if (location.latitude !== null && location.longitude !== null) {
      existingDistrict.lat = location.latitude;
      existingDistrict.lng = location.longitude;
    }
  });

  const activeRegions = regions.filter(region => !applyOverride(region.id, undefined, region.name).deleted);

  activeRegions.forEach(region => {
    region.cities.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    region.cities.forEach(city => city.districts.sort((a, b) => a.name.localeCompare(b.name, 'ar')));
  });
  return activeRegions;
}

// Bounding box strictly for Saudi Arabia
export const SAUDI_BOUNDS = {
  minLat: 16.0,
  maxLat: 32.5,
  minLng: 34.5,
  maxLng: 56.0,
};

export function isInsideSaudiArabia(lat: number, lng: number): boolean {
  return (
    lat >= SAUDI_BOUNDS.minLat &&
    lat <= SAUDI_BOUNDS.maxLat &&
    lng >= SAUDI_BOUNDS.minLng &&
    lng <= SAUDI_BOUNDS.maxLng
  );
}

export const SAUDI_REGIONS: Region[] = [
  {
    id: 'riyadh',
    name: 'منطقة الرياض',
    lat: 24.7136,
    lng: 46.6753,
    cities: [
      {
        id: 'riyadh_city',
        name: 'مدينة الرياض',
        lat: 24.7136,
        lng: 46.6753,
        districts: [
          { id: 'al_yasmin', name: 'حي الياسمين' },
          { id: 'al_malqa', name: 'حي الملقا' },
          { id: 'al_sahafa', name: 'حي الصحافة' },
          { id: 'al_narjis', name: 'حي النرجس' },
          { id: 'hittin', name: 'حي حطين' },
          { id: 'al_olaya', name: 'حي العليا' },
          { id: 'al_sulaimaniyah', name: 'حي السليمانية' },
          { id: 'al_rawdah', name: 'حي الروضة' },
          { id: 'al_nakheel', name: 'حي النخيل' },
          { id: 'al_aqiq', name: 'حي العقيق' },
          { id: 'al_wadi', name: 'حي الوادي' },
          { id: 'al_falah', name: 'حي الفلاح' },
          { id: 'qurtubah', name: 'حي قرطبة' },
          { id: 'al_hamra', name: 'حي الحمراء' },
          { id: 'al_shifa', name: 'حي الشفا' },
          { id: 'al_suwaidi', name: 'حي السويدي' },
          { id: 'laban', name: 'حي ضاحية لبن' },
          { id: 'tuwaiq', name: 'حي طويق' },
        ],
      },
      {
        id: 'al_kharj',
        name: 'الخرج',
        lat: 24.1554,
        lng: 47.312,
        districts: [
          { id: 'kharj_khalidiyah', name: 'حي الخالدية' },
          { id: 'kharj_rawdah', name: 'حي الروضة' },
          { id: 'kharj_andalus', name: 'حي الأندلس' },
        ],
      },
      {
        id: 'diriyah',
        name: 'الدرعية',
        lat: 24.7342,
        lng: 46.5756,
        districts: [
          { id: 'diriyah_bujairi', name: 'حي البجيري' },
          { id: 'diriyah_turaif', name: 'حي الطريف' },
          { id: 'diriyah_khalidiyah', name: 'حي الخالدية' },
        ],
      },
    ],
  },
  {
    id: 'makkah',
    name: 'منطقة مكة المكرمة',
    lat: 21.4225,
    lng: 39.8262,
    cities: [
      {
        id: 'jeddah',
        name: 'جدة',
        lat: 21.5433,
        lng: 39.1728,
        districts: [
          { id: 'jeddah_rawdah', name: 'حي الروضة' },
          { id: 'jeddah_zahra', name: 'حي الزهراء' },
          { id: 'jeddah_hamra', name: 'حي الحمراء' },
          { id: 'jeddah_shati', name: 'حي الشاطئ' },
          { id: 'jeddah_muhammadiyah', name: 'حي المحمدية' },
          { id: 'jeddah_naeem', name: 'حي النعيم' },
          { id: 'jeddah_safa', name: 'حي الصفا' },
          { id: 'jeddah_marwah', name: 'حي المروة' },
          { id: 'jeddah_samir', name: 'حي السامر' },
          { id: 'jeddah_abhor_shamaliyah', name: 'حي أبحر الشمالية' },
          { id: 'jeddah_abhor_janubiyah', name: 'حي أبحر الجنوبية' },
        ],
      },
      {
        id: 'makkah_city',
        name: 'مكة المكرمة',
        lat: 21.3891,
        lng: 39.8579,
        districts: [
          { id: 'makkah_aziziyah', name: 'حي العزيزية' },
          { id: 'makkah_shawqiyah', name: 'حي الشوقية' },
          { id: 'makkah_awali', name: 'حي العوالي' },
          { id: 'makkah_nawariyah', name: 'حي النوارية' },
          { id: 'makkah_zahir', name: 'حي الزاهر' },
          { id: 'makkah_rusayfah', name: 'حي الرصيفة' },
        ],
      },
      {
        id: 'taif',
        name: 'الطائف',
        lat: 21.2854,
        lng: 40.4222,
        districts: [
          { id: 'taif_shahar', name: 'حي شهار' },
          { id: 'taif_qutbiyah', name: 'حي القطبية' },
          { id: 'taif_ruddaf', name: 'حي الردف' },
          { id: 'taif_hawiyah', name: 'حي الحوية' },
        ],
      },
    ],
  },
  {
    id: 'eastern',
    name: 'المنطقة الشرقية',
    lat: 26.4207,
    lng: 50.0888,
    cities: [
      {
        id: 'dammam',
        name: 'الدمام',
        lat: 26.4207,
        lng: 50.0888,
        districts: [
          { id: 'dammam_shati', name: 'حي الشاطئ' },
          { id: 'dammam_faisaliyah', name: 'حي الفيصلية' },
          { id: 'dammam_jalawiyah', name: 'حي الجلوية' },
          { id: 'dammam_mazruiyah', name: 'حي المزروعية' },
          { id: 'dammam_anood', name: 'حي العنود' },
          { id: 'dammam_fursan', name: 'حي الفرسان' },
        ],
      },
      {
        id: 'khobar',
        name: 'الخبر',
        lat: 26.2172,
        lng: 50.1971,
        districts: [
          { id: 'khobar_hizam_thahabi', name: 'حي الحزام الذهبي' },
          { id: 'khobar_hizam_akhdar', name: 'حي الحزام الأخضر' },
          { id: 'khobar_rawabi', name: 'حي الروابي' },
          { id: 'khobar_ulaya', name: 'حي العليا' },
          { id: 'khobar_doha', name: 'حي الدوحة' },
          { id: 'khobar_aqiqiyah', name: 'حي العقربية' },
        ],
      },
      {
        id: 'ahsa',
        name: 'الأحساء / الهفوف',
        lat: 25.3835,
        lng: 49.5864,
        districts: [
          { id: 'ahsa_koot', name: 'حي الكوت' },
          { id: 'ahsa_khaldiyah', name: 'حي الخالدية' },
          { id: 'ahsa_mubarraz', name: 'حي المبرز' },
        ],
      },
      {
        id: 'jubail',
        name: 'الجبيل',
        lat: 27.0046,
        lng: 49.6606,
        districts: [
          { id: 'jubail_fanateer', name: 'حي الفناتير' },
          { id: 'jubail_deffi', name: 'حي الدفي' },
          { id: 'jubail_balad', name: 'حي الجبيل البلد' },
        ],
      },
    ],
  },
  {
    id: 'madinah',
    name: 'منطقة المدينة المنورة',
    lat: 24.5247,
    lng: 39.5692,
    cities: [
      {
        id: 'madinah_city',
        name: 'المدينة المنورة',
        lat: 24.5247,
        lng: 39.5692,
        districts: [
          { id: 'madinah_qiblatain', name: 'حي القبلتين' },
          { id: 'madinah_quba', name: 'حي قباء' },
          { id: 'madinah_khalidiyah', name: 'حي الخالدية' },
          { id: 'madinah_azhari', name: 'حي الأزهري' },
          { id: 'madinah_salam', name: 'حي السلام' },
        ],
      },
      {
        id: 'yanbu',
        name: 'ينبع',
        lat: 24.0895,
        lng: 38.0637,
        districts: [
          { id: 'yanbu_sinaiah', name: 'ينبع الصناعية' },
          { id: 'yanbu_bahr', name: 'ينبع البحر' },
        ],
      },
    ],
  },
  {
    id: 'qassim',
    name: 'منطقة القصيم',
    lat: 26.326,
    lng: 43.975,
    cities: [
      {
        id: 'buraidah',
        name: 'بريدة',
        lat: 26.326,
        lng: 43.975,
        districts: [
          { id: 'buraidah_faisaliyah', name: 'حي الفيصلية' },
          { id: 'buraidah_iskan', name: 'حي الإسكان' },
          { id: 'buraidah_safra', name: 'حي الصفراء' },
        ],
      },
      {
        id: 'unaizah',
        name: 'عنيزة',
        lat: 26.0844,
        lng: 43.9936,
        districts: [
          { id: 'unaizah_ashrafiyah', name: 'حي الأشرفية' },
          { id: 'unaizah_qadisiyah', name: 'حي القادسية' },
        ],
      },
    ],
  },
  {
    id: 'asir',
    name: 'منطقة عسير',
    lat: 18.2164,
    lng: 42.5053,
    cities: [
      {
        id: 'abha',
        name: 'أبها',
        lat: 18.2164,
        lng: 42.5053,
        districts: [
          { id: 'abha_mansak', name: 'حي المنسك' },
          { id: 'abha_dhbab', name: 'حي الضباب' },
          { id: 'abha_khalidiyah', name: 'حي الخالدية' },
        ],
      },
      {
        id: 'khamis_mushait',
        name: 'خميس مشيط',
        lat: 18.3065,
        lng: 42.7335,
        districts: [
          { id: 'khamis_husam', name: 'حي حسام' },
          { id: 'khamis_shafa', name: 'حي الشفا' },
        ],
      },
    ],
  },
  {
    id: 'tabuk',
    name: 'منطقة تبوك',
    lat: 28.3835,
    lng: 36.5662,
    cities: [
      {
        id: 'tabuk_city',
        name: 'مدينة تبوك',
        lat: 28.3835,
        lng: 36.5662,
        districts: [
          { id: 'tabuk_murjan', name: 'حي المرجان' },
          { id: 'tabuk_wurud', name: 'حي الورود' },
          { id: 'tabuk_sulaimaniyah', name: 'حي السليمانية' },
        ],
      },
    ],
  },
  {
    id: 'hail',
    name: 'منطقة حائل',
    lat: 27.5219,
    lng: 41.6907,
    cities: [
      {
        id: 'hail_city',
        name: 'مدينة حائل',
        lat: 27.5219,
        lng: 41.6907,
        districts: [
          { id: 'hail_jamiyin', name: 'حي الجامعيين' },
          { id: 'hail_nuqrah', name: 'حي النقرة' },
          { id: 'hail_wasit', name: 'حي الوسيطاء' },
        ],
      },
    ],
  },
  {
    id: 'northern_borders',
    name: 'منطقة الحدود الشمالية',
    lat: 30.9753,
    lng: 41.0381,
    cities: [
      {
        id: 'arar',
        name: 'عرعر',
        lat: 30.9753,
        lng: 41.0381,
        districts: [
          { id: 'arar_khalidiyah', name: 'حي الخالدية' },
          { id: 'arar_rawdah', name: 'حي الروضة' },
        ],
      },
    ],
  },
  {
    id: 'jazan',
    name: 'منطقة جازان',
    lat: 16.8892,
    lng: 42.5706,
    cities: [
      {
        id: 'jazan_city',
        name: 'مدينة جازان',
        lat: 16.8892,
        lng: 42.5706,
        districts: [
          { id: 'jazan_shati', name: 'حي الشاطئ' },
          { id: 'jazan_suwais', name: 'حي السويس' },
        ],
      },
    ],
  },
  {
    id: 'najran',
    name: 'منطقة نجران',
    lat: 17.4924,
    lng: 44.1277,
    cities: [
      {
        id: 'najran_city',
        name: 'مدينة نجران',
        lat: 17.4924,
        lng: 44.1277,
        districts: [
          { id: 'najran_fهد', name: 'حي الفهد' },
          { id: 'najran_khalidiyah', name: 'حي الخالدية' },
        ],
      },
    ],
  },
  {
    id: 'baha',
    name: 'منطقة الباحة',
    lat: 20.0129,
    lng: 41.4677,
    cities: [
      {
        id: 'baha_city',
        name: 'مدينة الباحة',
        lat: 20.0129,
        lng: 41.4677,
        districts: [
          { id: 'baha_balad', name: 'حي البلد' },
          { id: 'baha_shafa', name: 'حي الشفاء' },
        ],
      },
    ],
  },
  {
    id: 'jouf',
    name: 'منطقة الجوف',
    lat: 29.9697,
    lng: 40.2064,
    cities: [
      {
        id: 'sakaka',
        name: 'سكاكا',
        lat: 29.9697,
        lng: 40.2064,
        districts: [
          { id: 'sakaka_faisaliyah', name: 'حي الفيصلية' },
          { id: 'sakaka_zawoor', name: 'حي الزهور' },
        ],
      },
    ],
  },
];
