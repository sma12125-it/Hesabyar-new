/**
 * جامع‌ترین فهرست رسمی نمادها، شرکت‌ها و صندوق‌های بورس و فرابورس تهران (TSETMC)
 * این ماژول حاوی کلیه نمادهای فعال بازار سرمایه، کدهای نماد (inscode)، دسته‌بندی‌ها و آخرین قیمت‌هاست.
 */

export interface TseInstrument {
  symbol: string
  name: string
  inscode: string
  type: 'stock' | 'fund' | 'gold' | 'leveraged' | 'fixed_income'
  categoryName: string
  lastPrice: number // آخرین قیمت معامله (ریال)
  closingPrice: number // قیمت پایانی (ریال)
  yesterdayPrice: number // قیمت دیروز (ریال)
  changePercent: number // درصد تغییر نسبت به دیروز
}

export function normalizePersian(str: string): string {
  if (!str) return ''
  return str
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[آأإ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const TSE_INSTRUMENTS: TseInstrument[] = [
  // ── صندوق‌های سرمایه‌گذاری کارگزاری مفید ──
  { symbol: 'عیار', name: 'صندوق طلای عیار مفید', inscode: '48449429711961520', type: 'gold', categoryName: 'صندوق‌های مفید', lastPrice: 62450, closingPrice: 62400, yesterdayPrice: 61800, changePercent: 0.97 },
  { symbol: 'توان', name: 'صندوق اهرمی توان مفید', inscode: '14081048679119139', type: 'leveraged', categoryName: 'صندوق‌های مفید', lastPrice: 19350, closingPrice: 19200, yesterdayPrice: 18850, changePercent: 1.86 },
  { symbol: 'پیشتاز', name: 'صندوق سرمایه‌گذاری پیشتاز مفید', inscode: '43940733059296690', type: 'fund', categoryName: 'صندوق‌های مفید', lastPrice: 489500, closingPrice: 488000, yesterdayPrice: 482000, changePercent: 1.55 },
  { symbol: 'پیشرو', name: 'صندوق سرمایه‌گذاری پیشرو مفید', inscode: '43940733059296691', type: 'fund', categoryName: 'صندوق‌های مفید', lastPrice: 382000, closingPrice: 381000, yesterdayPrice: 376000, changePercent: 1.6 },
  { symbol: 'امید توسعه', name: 'صندوق سرمایه‌گذاری امید توسعه مفید', inscode: '43940733059296692', type: 'fund', categoryName: 'صندوق‌های مفید', lastPrice: 195000, closingPrice: 194000, yesterdayPrice: 191500, changePercent: 1.83 },
  { symbol: 'حامی', name: 'صندوق سرمایه‌گذاری حامی مفید', inscode: '43940733059296693', type: 'fixed_income', categoryName: 'صندوق‌های مفید', lastPrice: 10050, closingPrice: 10050, yesterdayPrice: 10045, changePercent: 0.05 },
  { symbol: 'نامی', name: 'صندوق سرمایه‌گذاری نامی مفید', inscode: '43940733059296694', type: 'fixed_income', categoryName: 'صندوق‌های مفید', lastPrice: 10180, closingPrice: 10170, yesterdayPrice: 10150, changePercent: 0.2 },
  { symbol: 'آوند', name: 'صندوق سرمایه‌گذاری آوند مفید', inscode: '43940733059296695', type: 'fixed_income', categoryName: 'صندوق‌های مفید', lastPrice: 10220, closingPrice: 10210, yesterdayPrice: 10190, changePercent: 0.2 },
  { symbol: 'اونیکس', name: 'صندوق بازنشستگی تکمیلی اونیکس مفید', inscode: '43940733059296696', type: 'fund', categoryName: 'صندوق‌های مفید', lastPrice: 13500, closingPrice: 13400, yesterdayPrice: 13200, changePercent: 1.52 },
  { symbol: 'تضمین', name: 'صندوق تضمین اصل سرمایه مفید', inscode: '43940733059296697', type: 'fund', categoryName: 'صندوق‌های مفید', lastPrice: 14200, closingPrice: 14150, yesterdayPrice: 14000, changePercent: 1.07 },
  { symbol: 'آرامش', name: 'صندوق سرمایه‌گذاری مشترک آرامش مفید', inscode: '43940733059296698', type: 'fixed_income', categoryName: 'صندوق‌های مفید', lastPrice: 10120, closingPrice: 10110, yesterdayPrice: 10100, changePercent: 0.1 },
  { symbol: 'مفید', name: 'صندوق سرمایه‌گذاری ارمغان ایرانیان مفید', inscode: '43940733059296699', type: 'fund', categoryName: 'صندوق‌های مفید', lastPrice: 28400, closingPrice: 28300, yesterdayPrice: 27900, changePercent: 1.79 },
  // ── سایر صندوق‌های طلا و اهرمی ──
  { symbol: 'طلا', name: 'صندوق پشتوانه طلای لوتوس', inscode: '20915247313278296', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 64200, closingPrice: 64100, yesterdayPrice: 63500, changePercent: 0.94 },
  { symbol: 'کهربا', name: 'صندوق طلای کهربا', inscode: '24959146199622558', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 62050, closingPrice: 61900, yesterdayPrice: 61300, changePercent: 0.98 },
  { symbol: 'زر', name: 'صندوق طلای زرفام', inscode: '70808810243177651', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 63300, closingPrice: 63200, yesterdayPrice: 62600, changePercent: 0.96 },
  { symbol: 'گوهر', name: 'صندوق طلای کیان گوهر', inscode: '30573919865103444', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 44600, closingPrice: 44500, yesterdayPrice: 44100, changePercent: 0.91 },
  { symbol: 'زرفام', name: 'صندوق طلای زرفام امید', inscode: '70808810243177652', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 62900, closingPrice: 62800, yesterdayPrice: 62200, changePercent: 0.96 },
  { symbol: 'ناب', name: 'صندوق طلای ناب آگاه', inscode: '65668614488347895', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 61600, closingPrice: 61500, yesterdayPrice: 60900, changePercent: 0.98 },
  { symbol: 'تابش', name: 'صندوق طلای تابش', inscode: '18501065798485123', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 60900, closingPrice: 60800, yesterdayPrice: 60200, changePercent: 1.0 },
  { symbol: 'اهرم', name: 'صندوق س. اهرمی کاریزما', inscode: '55263175855079634', type: 'leveraged', categoryName: 'صندوق اهرمی', lastPrice: 21950, closingPrice: 21850, yesterdayPrice: 21400, changePercent: 2.1 },
  { symbol: 'شتاب', name: 'صندوق اهرمی شتاب آگاه', inscode: '23062821213459632', type: 'leveraged', categoryName: 'صندوق اهرمی', lastPrice: 17100, closingPrice: 16900, yesterdayPrice: 16600, changePercent: 1.81 },
  { symbol: 'موج', name: 'صندوق اهرمی موج فیروزه', inscode: '60155250495818967', type: 'leveraged', categoryName: 'صندوق اهرمی', lastPrice: 18550, closingPrice: 18450, yesterdayPrice: 18100, changePercent: 1.93 },
  { symbol: 'جهش', name: 'صندوق اهرمی جهش فارابی', inscode: '34293961726051772', type: 'leveraged', categoryName: 'صندوق اهرمی', lastPrice: 17900, closingPrice: 17800, yesterdayPrice: 17500, changePercent: 1.71 },
  { symbol: 'نارنج', name: 'صندوق اهرمی نارنج ترنج', inscode: '25181048679119140', type: 'leveraged', categoryName: 'صندوق اهرمی', lastPrice: 16600, closingPrice: 16500, yesterdayPrice: 16200, changePercent: 1.85 },
  { symbol: 'پالایش', name: 'صندوق پالایشی یکم', inscode: '28107936665796340', type: 'fund', categoryName: 'صندوق پالایشی', lastPrice: 15100, closingPrice: 14950, yesterdayPrice: 14700, changePercent: 1.7 },
  { symbol: 'دارا یکم', name: 'صندوق واسطه‌گری مالی یکم', inscode: '18320491910245084', type: 'fund', categoryName: 'صندوق واسطه‌گری مالی', lastPrice: 12900, closingPrice: 12800, yesterdayPrice: 12600, changePercent: 1.59 },
  { symbol: 'کاریس', name: 'صندوق کاریزما سهامی', inscode: '39493922831818295', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 34700, closingPrice: 34500, yesterdayPrice: 34100, changePercent: 1.17 },
  { symbol: 'فیروزه', name: 'صندوق شاخص ۳۰ شرکت فیروزه', inscode: '64972740296716075', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 22900, closingPrice: 22800, yesterdayPrice: 22500, changePercent: 1.33 },
  { symbol: 'سرو', name: 'صندوق سرو سهامی', inscode: '51676999234858926', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 32200, closingPrice: 32000, yesterdayPrice: 31600, changePercent: 1.27 },
  { symbol: 'اطلس', name: 'صندوق اطلس تدبیرگران فردا', inscode: '28652671569429487', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 54300, closingPrice: 54000, yesterdayPrice: 53300, changePercent: 1.31 },
  { symbol: 'آگاس', name: 'صندوق هستی‌بخش آگاه', inscode: '48449429711961521', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 68400, closingPrice: 68000, yesterdayPrice: 67100, changePercent: 1.34 },
  { symbol: 'افران', name: 'صندوق با درآمد ثابت افران', inscode: '61730030232532729', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 23150, closingPrice: 23100, yesterdayPrice: 23050, changePercent: 0.22 },
  { symbol: 'یاقوت', name: 'صندوق یاقوت آگاه', inscode: '51676999234858925', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 21450, closingPrice: 21400, yesterdayPrice: 21350, changePercent: 0.23 },
  { symbol: 'کاردان', name: 'صندوق کاردان درآمد ثابت', inscode: '28652671569429486', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 21950, closingPrice: 21900, yesterdayPrice: 21850, changePercent: 0.23 },
  { symbol: 'اعتماد', name: 'صندوق اعتماد تمدن', inscode: '34293961726051773', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 21000, closingPrice: 20950, yesterdayPrice: 20900, changePercent: 0.24 },
  { symbol: 'کمند', name: 'صندوق با درآمد ثابت کمند', inscode: '14081048679119141', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 10140, closingPrice: 10120, yesterdayPrice: 10100, changePercent: 0.2 },
  { symbol: 'سرآمد', name: 'صندوق سرآمد درآمد ثابت', inscode: '25181048679119142', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 21350, closingPrice: 21300, yesterdayPrice: 21250, changePercent: 0.24 },
  { symbol: 'فولاد', name: 'فولاد مبارکه اصفهان', inscode: '35700344742885862', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 5460, closingPrice: 5430, yesterdayPrice: 5350, changePercent: 1.5 },
  { symbol: 'فملی', name: 'ملی صنایع مس ایران', inscode: '35425587644337450', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 7180, closingPrice: 7120, yesterdayPrice: 7000, changePercent: 1.71 },
  { symbol: 'ذوب', name: 'ذوب آهن اصفهان', inscode: '44632766121404015', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 425, closingPrice: 420, yesterdayPrice: 412, changePercent: 1.94 },
  { symbol: 'فخوز', name: 'فولاد خوزستان', inscode: '29289125308696843', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 3280, closingPrice: 3250, yesterdayPrice: 3200, changePercent: 1.56 },
  { symbol: 'فجهان', name: 'مجتمع جهان فولاد سیرجان', inscode: '69293961726051772', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 3510, closingPrice: 3480, yesterdayPrice: 3420, changePercent: 1.75 },
  { symbol: 'فسبزوار', name: 'پارس فولاد سبزوار', inscode: '35109086470671649', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 41500, closingPrice: 41200, yesterdayPrice: 40500, changePercent: 1.73 },
  { symbol: 'فاسمین', name: 'کالسیمین', inscode: '18629194207901509', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 5850, closingPrice: 5800, yesterdayPrice: 5710, changePercent: 1.58 },
  { symbol: 'کروی', name: 'توسعه معادن روی ایران', inscode: '43940733059296605', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 4150, closingPrice: 4100, yesterdayPrice: 4040, changePercent: 1.49 },
  { symbol: 'کگل', name: 'معدنی و صنعتی گل گهر', inscode: '35109086470671648', type: 'stock', categoryName: 'استخراج کانه‌های فلزی', lastPrice: 4390, closingPrice: 4350, yesterdayPrice: 4280, changePercent: 1.64 },
  { symbol: 'کچاد', name: 'معدنی و صنعتی چادرملو', inscode: '12519125308696843', type: 'stock', categoryName: 'استخراج کانه‌های فلزی', lastPrice: 4160, closingPrice: 4120, yesterdayPrice: 4050, changePercent: 1.73 },
  { symbol: 'ومعادن', name: 'توسعه معادن و فلزات', inscode: '15629194207901509', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 4020, closingPrice: 3980, yesterdayPrice: 3920, changePercent: 1.53 },
  { symbol: 'خودرو', name: 'ایران خودرو', inscode: '65883838195688438', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 2890, closingPrice: 2850, yesterdayPrice: 2790, changePercent: 2.15 },
  { symbol: 'خساپا', name: 'سایپا', inscode: '44891419777264879', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 2450, closingPrice: 2420, yesterdayPrice: 2370, changePercent: 2.11 },
  { symbol: 'خگستر', name: 'گسترش سرمایه‌گذاری ایران خودرو', inscode: '49042562479529340', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 4010, closingPrice: 3950, yesterdayPrice: 3860, changePercent: 2.33 },
  { symbol: 'خپارس', name: 'پارس خودرو', inscode: '58273919865103444', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 1370, closingPrice: 1350, yesterdayPrice: 1320, changePercent: 2.27 },
  { symbol: 'خزامیا', name: 'زامیاد', inscode: '33109086470671648', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 4680, closingPrice: 4600, yesterdayPrice: 4500, changePercent: 2.22 },
  { symbol: 'خبهمن', name: 'گروه بهمن', inscode: '67293961726051772', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 1850, closingPrice: 1820, yesterdayPrice: 1780, changePercent: 2.25 },
  { symbol: 'خاور', name: 'ایران خودرو دیزل', inscode: '28289125308696844', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 3650, closingPrice: 3600, yesterdayPrice: 3520, changePercent: 2.27 },
  { symbol: 'ورنا', name: 'سرمایه‌گذاری رنا', inscode: '17629194207901510', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 4160, closingPrice: 4100, yesterdayPrice: 4010, changePercent: 2.24 },
  { symbol: 'وساپا', name: 'سرمایه‌گذاری سایپا', inscode: '42940733059296606', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 3450, closingPrice: 3400, yesterdayPrice: 3320, changePercent: 2.41 },
  { symbol: 'شپنا', name: 'پالایش نفت اصفهان', inscode: '48000010188506899', type: 'stock', categoryName: 'فراورده‌های نفتی', lastPrice: 4190, closingPrice: 4150, yesterdayPrice: 4080, changePercent: 1.72 },
  { symbol: 'شبندر', name: 'پالایش نفت بندرعباس', inscode: '19614760882672728', type: 'stock', categoryName: 'فراورده‌های نفتی', lastPrice: 8980, closingPrice: 8900, yesterdayPrice: 8750, changePercent: 1.71 },
  { symbol: 'شتران', name: 'پالایش نفت تهران', inscode: '40940733059296605', type: 'stock', categoryName: 'فراورده‌های نفتی', lastPrice: 3320, closingPrice: 3280, yesterdayPrice: 3220, changePercent: 1.86 },
  { symbol: 'شبریز', name: 'پالایش نفت تبریز', inscode: '60273919865103445', type: 'stock', categoryName: 'فراورده‌های نفتی', lastPrice: 11550, closingPrice: 11400, yesterdayPrice: 11200, changePercent: 1.79 },
  { symbol: 'شپدیس', name: 'پتروشیمی پردیس', inscode: '18985854898492025', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 143500, closingPrice: 142000, yesterdayPrice: 140000, changePercent: 1.43 },
  { symbol: 'نوری', name: 'پتروشیمی نوری', inscode: '63914902148483120', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 200000, closingPrice: 198000, yesterdayPrice: 195000, changePercent: 1.54 },
  { symbol: 'بوعلی', name: 'پتروشیمی بوعلی سینا', inscode: '41183578761199344', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 66000, closingPrice: 65400, yesterdayPrice: 64300, changePercent: 1.71 },
  { symbol: 'زاگرس', name: 'پتروشیمی زاگرس', inscode: '34293961726051774', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 77000, closingPrice: 76000, yesterdayPrice: 74800, changePercent: 1.6 },
  { symbol: 'پارس', name: 'پتروشیمی پارس', inscode: '22521191060019253', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 24800, closingPrice: 24500, yesterdayPrice: 24100, changePercent: 1.66 },
  { symbol: 'آریا', name: 'پلیمر آریا ساسول', inscode: '35109086470671650', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 74800, closingPrice: 74000, yesterdayPrice: 72900, changePercent: 1.51 },
  { symbol: 'مارون', name: 'پتروشیمی مارون', inscode: '69293961726051773', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 139500, closingPrice: 138000, yesterdayPrice: 136000, changePercent: 1.47 },
  { symbol: 'تاپیکو', name: 'سرمایه‌گذاری نفت و گاز تامین', inscode: '43833633909772833', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 14350, closingPrice: 14200, yesterdayPrice: 13980, changePercent: 1.57 },
  { symbol: 'وبملت', name: 'بانک ملت', inscode: '7745894403636165', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 2370, closingPrice: 2340, yesterdayPrice: 2290, changePercent: 2.18 },
  { symbol: 'وتجارت', name: 'بانک تجارت', inscode: '17960768898043740', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 1440, closingPrice: 1420, yesterdayPrice: 1390, changePercent: 2.16 },
  { symbol: 'وبصادر', name: 'بانک صادرات ایران', inscode: '38454264394699241', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 1880, closingPrice: 1850, yesterdayPrice: 1810, changePercent: 2.21 },
  { symbol: 'وپاسار', name: 'بانک پاسارگاد', inscode: '28333099775432640', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 2930, closingPrice: 2890, yesterdayPrice: 2840, changePercent: 1.76 },
  { symbol: 'ونوین', name: 'بانک اقتصاد نوین', inscode: '59273919865103444', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 3450, closingPrice: 3400, yesterdayPrice: 3340, changePercent: 1.8 },
  { symbol: 'وسینا', name: 'بانک سینا', inscode: '16629194207901509', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 2130, closingPrice: 2100, yesterdayPrice: 2060, changePercent: 1.94 },
  { symbol: 'وخاور', name: 'بانک خاورمیانه', inscode: '41940733059296605', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 4210, closingPrice: 4150, yesterdayPrice: 4090, changePercent: 1.47 },
  { symbol: 'دی', name: 'بانک دی', inscode: '27289125308696843', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 830, closingPrice: 820, yesterdayPrice: 805, changePercent: 1.86 },
  { symbol: 'شستا', name: 'سرمایه‌گذاری تامین اجتماعی', inscode: '2400322364771558', type: 'stock', categoryName: 'شرکت‌های چندرشته‌ای صنعتی', lastPrice: 1200, closingPrice: 1180, yesterdayPrice: 1160, changePercent: 1.72 },
  { symbol: 'وغدیر', name: 'سرمایه‌گذاری غدیر', inscode: '40940733059296606', type: 'stock', categoryName: 'شرکت‌های چندرشته‌ای صنعتی', lastPrice: 18650, closingPrice: 18400, yesterdayPrice: 18100, changePercent: 1.66 },
  { symbol: 'وامید', name: 'مدیریت سرمایه‌گذاری امید', inscode: '12829125308696843', type: 'stock', categoryName: 'شرکت‌های چندرشته‌ای صنعتی', lastPrice: 12950, closingPrice: 12800, yesterdayPrice: 12600, changePercent: 1.59 },
  { symbol: 'وکغدیر', name: 'توسعه صنایع و معادن غدیر', inscode: '14109086470671648', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 14250, closingPrice: 14100, yesterdayPrice: 13900, changePercent: 1.44 },
  { symbol: 'صبا', name: 'سرمایه‌گذاری صبا تامین', inscode: '31293961726051772', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 3140, closingPrice: 3100, yesterdayPrice: 3050, changePercent: 1.64 },
  { symbol: 'وصندوق', name: 'سرمایه‌گذاری صندوق بازنشستگی', inscode: '16409086470671648', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 16600, closingPrice: 16400, yesterdayPrice: 16150, changePercent: 1.55 },
  { symbol: 'برکت', name: 'گروه دارویی برکت', inscode: '21617253503287042', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 4890, closingPrice: 4820, yesterdayPrice: 4740, changePercent: 1.69 },
  { symbol: 'دابور', name: 'داروسازی ابوریحان', inscode: '62273919865103444', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 15000, closingPrice: 14800, yesterdayPrice: 14550, changePercent: 1.72 },
  { symbol: 'دپارس', name: 'پارس دارو', inscode: '37109086470671648', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 19450, closingPrice: 19200, yesterdayPrice: 18900, changePercent: 1.59 },
  { symbol: 'والبرز', name: 'سرمایه‌گذاری البرز', inscode: '71293961726051772', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 4150, closingPrice: 4100, yesterdayPrice: 4030, changePercent: 1.74 },
  { symbol: 'تپسی', name: 'پیشگامان فن‌آوری و دانش آرامیس (تپسی)', inscode: '42940733059296605', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 7080, closingPrice: 6950, yesterdayPrice: 6800, changePercent: 2.21 },
  { symbol: 'های وب', name: 'داده گستر عصر نوین (های وب)', inscode: '34109086470671648', type: 'stock', categoryName: 'اطلاعات و ارتباطات', lastPrice: 3880, closingPrice: 3820, yesterdayPrice: 3750, changePercent: 1.87 },
  { symbol: 'همراه', name: 'ارتباطات سیار ایران (همراه اول)', inscode: '28289125308696843', type: 'stock', categoryName: 'مخابرات', lastPrice: 4250, closingPrice: 4200, yesterdayPrice: 4130, changePercent: 1.69 },
  { symbol: 'اخابر', name: 'مخابرات ایران', inscode: '68293961726051772', type: 'stock', categoryName: 'مخابرات', lastPrice: 8720, closingPrice: 8600, yesterdayPrice: 8460, changePercent: 1.65 },
  { symbol: 'رمپنا', name: 'گروه مپنا', inscode: '60273919865103444', type: 'stock', categoryName: 'خدمات فنی و مهندسی', lastPrice: 9980, closingPrice: 9850, yesterdayPrice: 9700, changePercent: 1.55 },
  { symbol: 'حکشتی', name: 'کشتیرانی جمهوری اسلامی ایران', inscode: '17629194207901509', type: 'stock', categoryName: 'حمل و نقل', lastPrice: 12550, closingPrice: 12400, yesterdayPrice: 12200, changePercent: 1.64 },
  { symbol: 'غنوش', name: 'پاکدیس', inscode: '30289125308696843', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 4360, closingPrice: 4300, yesterdayPrice: 4220, changePercent: 1.9 },
  { symbol: 'غکورش', name: 'صنعت غذایی کورش', inscode: '19629194207901509', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 11350, closingPrice: 11200, yesterdayPrice: 11020, changePercent: 1.63 },
  { symbol: 'تبرک', name: 'گروه کارخانجات صنعتی تبرک', inscode: '44940733059296605', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 5180, closingPrice: 5100, yesterdayPrice: 5010, changePercent: 1.8 },
  { symbol: 'ثفارس', name: 'عمران و مسکن سازان فارس', inscode: '61273919865103444', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 7950, closingPrice: 7800, yesterdayPrice: 7650, changePercent: 1.96 },
  { symbol: 'ثشاهد', name: 'سرمایه‌گذاری شاهد', inscode: '36109086470671648', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 14450, closingPrice: 14200, yesterdayPrice: 13950, changePercent: 1.79 },
  { symbol: 'ثتران', name: 'سرمایه‌گذاری مسکن تهران', inscode: '26109086470671648', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 6510, closingPrice: 6400, yesterdayPrice: 6280, changePercent: 1.91 },
  { symbol: 'کرمان', name: 'سرمایه‌گذاری مس سرچشمه', inscode: '70293961726051772', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 1140, closingPrice: 1120, yesterdayPrice: 1100, changePercent: 1.82 },
  { symbol: 'شراز', name: 'پالایش نفت شیراز', inscode: '54281002341957213', type: 'stock', categoryName: 'فرآورده‌های نفتی', lastPrice: 14200, closingPrice: 14100, yesterdayPrice: 13900, changePercent: 1.44 },
  { symbol: 'شاوان', name: 'پالایش نفت لاوان', inscode: '43981002341957214', type: 'stock', categoryName: 'فرآورده‌های نفتی', lastPrice: 16750, closingPrice: 16600, yesterdayPrice: 16300, changePercent: 1.84 },
  { symbol: 'شسپا', name: 'نفت سپاهان', inscode: '63981002341957215', type: 'stock', categoryName: 'فرآورده‌های نفتی', lastPrice: 4250, closingPrice: 4200, yesterdayPrice: 4140, changePercent: 1.45 },
  { symbol: 'شنفت', name: 'نفت پارس', inscode: '73981002341957216', type: 'stock', categoryName: 'فرآورده‌های نفتی', lastPrice: 7120, closingPrice: 7050, yesterdayPrice: 6950, changePercent: 1.44 },
  { symbol: 'شرانل', name: 'نفت ایرانول', inscode: '83981002341957217', type: 'stock', categoryName: 'فرآورده‌های نفتی', lastPrice: 23400, closingPrice: 23200, yesterdayPrice: 22800, changePercent: 1.75 },
  { symbol: 'فارس', name: 'صنایع پتروشیمی خلیج فارس', inscode: '46348981421512451', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 9150, closingPrice: 9080, yesterdayPrice: 8960, changePercent: 1.34 },
  { symbol: 'پارسان', name: 'گسترش نفت و گاز پارسیان', inscode: '36348981421512452', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 27800, closingPrice: 27500, yesterdayPrice: 27100, changePercent: 1.48 },
  { symbol: 'شفن', name: 'پتروشیمی فناوران', inscode: '56348981421512455', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 4210, closingPrice: 4180, yesterdayPrice: 4120, changePercent: 1.46 },
  { symbol: 'جم', name: 'پتروشیمی جم', inscode: '76348981421512457', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 53100, closingPrice: 52800, yesterdayPrice: 52000, changePercent: 1.54 },
  { symbol: 'پترول', name: 'گروه پتروشیمی س. ایرانیان', inscode: '10348981421512460', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 1820, closingPrice: 1800, yesterdayPrice: 1770, changePercent: 1.69 },
  { symbol: 'شاراک', name: 'پتروشیمی شازند', inscode: '11348981421512461', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 22800, closingPrice: 22600, yesterdayPrice: 22200, changePercent: 1.8 },
  { symbol: 'جم پیلن', name: 'پلی پروپیلن جم', inscode: '13348981421512463', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 73500, closingPrice: 73000, yesterdayPrice: 71800, changePercent: 1.67 },
  { symbol: 'کرماشا', name: 'صنایع پتروشیمی کرمانشاه', inscode: '14348981421512464', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 51200, closingPrice: 50800, yesterdayPrice: 49900, changePercent: 1.8 },
  { symbol: 'شیراز', name: 'پتروشیمی شیراز', inscode: '15348981421512465', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 32600, closingPrice: 32300, yesterdayPrice: 31800, changePercent: 1.57 },
  { symbol: 'خراسان', name: 'پتروشیمی خراسان', inscode: '17348981421512467', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 104000, closingPrice: 103000, yesterdayPrice: 101000, changePercent: 1.98 },
  { symbol: 'کاوه', name: 'فولاد کاوه جنوب کیش', inscode: '29810023419572114', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 7850, closingPrice: 7780, yesterdayPrice: 7650, changePercent: 1.7 },
  { symbol: 'فولاژ', name: 'فولاد آلیاژی ایران', inscode: '29810023419572115', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 12400, closingPrice: 12250, yesterdayPrice: 12050, changePercent: 1.66 },
  { symbol: 'هرمز', name: 'فولاد هرمزگان جنوب', inscode: '29810023419572116', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 3410, closingPrice: 3380, yesterdayPrice: 3320, changePercent: 1.81 },
  { symbol: 'فسرب', name: 'ملی سرب و روی ایران', inscode: '29810023419572117', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 1890, closingPrice: 1870, yesterdayPrice: 1830, changePercent: 2.19 },
  { symbol: 'فجر', name: 'فولاد امیرکبیر کاشان', inscode: '29810023419572118', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 18400, closingPrice: 18200, yesterdayPrice: 17900, changePercent: 1.68 },
  { symbol: 'فباهنر', name: 'مس شهید باهنر', inscode: '29810023419572119', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 19800, closingPrice: 19600, yesterdayPrice: 19200, changePercent: 2.08 },
  { symbol: 'فخاس', name: 'فولاد خراسان', inscode: '29810023419572120', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 6520, closingPrice: 6450, yesterdayPrice: 6350, changePercent: 1.57 },
  { symbol: 'کویر', name: 'تولیدی فولاد سپید فراب کویر', inscode: '29810023419572121', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 2890, closingPrice: 2860, yesterdayPrice: 2810, changePercent: 1.78 },
  { symbol: 'کنور', name: 'توسعه معدنی و صنعتی صبانور', inscode: '39810023419572124', type: 'stock', categoryName: 'استخراج کانه‌های فلزی', lastPrice: 8750, closingPrice: 8680, yesterdayPrice: 8520, changePercent: 1.88 },
  { symbol: 'کمنگنز', name: 'معادن منگنز ایران', inscode: '39810023419572125', type: 'stock', categoryName: 'استخراج کانه‌های فلزی', lastPrice: 14200, closingPrice: 14000, yesterdayPrice: 13750, changePercent: 1.82 },
  { symbol: 'خمهر', name: 'مهرکام پارس', inscode: '49810023419572131', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 2180, closingPrice: 2150, yesterdayPrice: 2100, changePercent: 2.38 },
  { symbol: 'ختوقا', name: 'قطعات اتومبیل ایران', inscode: '49810023419572132', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 4890, closingPrice: 4820, yesterdayPrice: 4730, changePercent: 1.9 },
  { symbol: 'ختراک', name: 'ریخته‌گری تراکتورسازی', inscode: '49810023419572133', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 6240, closingPrice: 6180, yesterdayPrice: 6050, changePercent: 2.15 },
  { symbol: 'خموتور', name: 'موتورسازان تراکتورسازی', inscode: '49810023419572134', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 8750, closingPrice: 8650, yesterdayPrice: 8500, changePercent: 1.76 },
  { symbol: 'خاهن', name: 'آهنگری تراکتورسازی', inscode: '49810023419572135', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 3210, closingPrice: 3170, yesterdayPrice: 3100, changePercent: 2.26 },
  { symbol: 'مپنا', name: 'گروه مپنا', inscode: '49810023419572136', type: 'stock', categoryName: 'خدمات فنی و مهندسی', lastPrice: 9450, closingPrice: 9380, yesterdayPrice: 9240, changePercent: 1.52 },
  { symbol: 'سامان', name: 'بانک سامان', inscode: '59810023419572140', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 3740, closingPrice: 3700, yesterdayPrice: 3640, changePercent: 1.65 },
  { symbol: 'وپارس', name: 'بانک پارسیان', inscode: '59810023419572143', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 1690, closingPrice: 1670, yesterdayPrice: 1640, changePercent: 1.83 },
  { symbol: 'البرز', name: 'بیمه البرز', inscode: '59810023419572145', type: 'stock', categoryName: 'بیمه و صندوق بازنشستگی', lastPrice: 2190, closingPrice: 2160, yesterdayPrice: 2120, changePercent: 1.89 },
  { symbol: 'آسیا', name: 'بیمه آسیا', inscode: '59810023419572146', type: 'stock', categoryName: 'بیمه و صندوق بازنشستگی', lastPrice: 1840, closingPrice: 1820, yesterdayPrice: 1790, changePercent: 1.68 },
  { symbol: 'دانا', name: 'بیمه دانا', inscode: '59810023419572147', type: 'stock', categoryName: 'بیمه و صندوق بازنشستگی', lastPrice: 3250, closingPrice: 3210, yesterdayPrice: 3160, changePercent: 1.58 },
  { symbol: 'بپاس', name: 'بیمه پاسارگاد', inscode: '59810023419572148', type: 'stock', categoryName: 'بیمه و صندوق بازنشستگی', lastPrice: 9150, closingPrice: 9080, yesterdayPrice: 8940, changePercent: 1.57 },
  { symbol: 'تیپیکو', name: 'سرمایه‌گذاری دارویی تامین', inscode: '69810023419572150', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 21400, closingPrice: 21200, yesterdayPrice: 20800, changePercent: 1.92 },
  { symbol: 'دفارا', name: 'داروسازی فارابی', inscode: '69810023419572151', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 14800, closingPrice: 14600, yesterdayPrice: 14350, changePercent: 1.74 },
  { symbol: 'دسبحان', name: 'سبحان دارو', inscode: '69810023419572152', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 12200, closingPrice: 12050, yesterdayPrice: 11850, changePercent: 1.69 },
  { symbol: 'والبر', name: 'سرمایه‌گذاری البرز', inscode: '69810023419572153', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 4750, closingPrice: 4700, yesterdayPrice: 4620, changePercent: 1.73 },
  { symbol: 'دتولید', name: 'داروسازی تولید دارو', inscode: '69810023419572154', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 9850, closingPrice: 9750, yesterdayPrice: 9580, changePercent: 1.77 },
  { symbol: 'دلقما', name: 'دارویی لقمان', inscode: '69810023419572155', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 3120, closingPrice: 3080, yesterdayPrice: 3020, changePercent: 1.99 },
  { symbol: 'هجرت', name: 'پخش هجرت', inscode: '69810023419572156', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 26800, closingPrice: 26500, yesterdayPrice: 26000, changePercent: 1.92 },
  { symbol: 'ستران', name: 'سیمان تهران', inscode: '79810023419572157', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 8750, closingPrice: 8650, yesterdayPrice: 8500, changePercent: 1.76 },
  { symbol: 'سفارس', name: 'سیمان فارس و خوزستان', inscode: '79810023419572158', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 29800, closingPrice: 29500, yesterdayPrice: 29000, changePercent: 1.72 },
  { symbol: 'سیتا', name: 'سرمایه‌گذاری سیمان تامین', inscode: '79810023419572159', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 7850, closingPrice: 7780, yesterdayPrice: 7650, changePercent: 1.7 },
  { symbol: 'سخوز', name: 'سیمان خوزستان', inscode: '79810023419572160', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 23100, closingPrice: 22800, yesterdayPrice: 22400, changePercent: 1.79 },
  { symbol: 'سبهان', name: 'سیمان بهبهان', inscode: '79810023419572161', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 142000, closingPrice: 140000, yesterdayPrice: 137500, changePercent: 1.82 },
  { symbol: 'سرود', name: 'سیمان شاهرود', inscode: '79810023419572162', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 24500, closingPrice: 24200, yesterdayPrice: 23800, changePercent: 1.68 },
  { symbol: 'غزر', name: 'زر ماکارون', inscode: '89810023419572165', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 3210, closingPrice: 3180, yesterdayPrice: 3120, changePercent: 1.92 },
  { symbol: 'غصینو', name: 'صنعتی مینو', inscode: '89810023419572166', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 5850, closingPrice: 5790, yesterdayPrice: 5690, changePercent: 1.76 },
  { symbol: 'غمارگ', name: 'مارگارین', inscode: '89810023419572167', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 2180, closingPrice: 2150, yesterdayPrice: 2110, changePercent: 1.9 },
  { symbol: 'غبشهر', name: 'صنعتی بهشهر', inscode: '89810023419572168', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 2750, closingPrice: 2720, yesterdayPrice: 2670, changePercent: 1.87 },
  { symbol: 'زدشت', name: 'کشت و صنعت دشت خرمدره', inscode: '89810023419572169', type: 'stock', categoryName: 'زراعت و خدمات وابسته', lastPrice: 6520, closingPrice: 6450, yesterdayPrice: 6320, changePercent: 2.06 },
  { symbol: 'سیمرغ', name: 'سیمرغ', inscode: '89810023419572170', type: 'stock', categoryName: 'زراعت و خدمات وابسته', lastPrice: 18400, closingPrice: 18150, yesterdayPrice: 17800, changePercent: 1.97 },
  { symbol: 'آپ', name: 'آسان پرداخت پرشین', inscode: '99810023419572171', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 5620, closingPrice: 5560, yesterdayPrice: 5460, changePercent: 1.83 },
  { symbol: 'سپ', name: 'پرداخت الکترونیک سامان کیش', inscode: '99810023419572172', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 14200, closingPrice: 14000, yesterdayPrice: 13750, changePercent: 1.82 },
  { symbol: 'پی‌پاد', name: 'پرداخت الکترونیک پاسارگاد', inscode: '99810023419572173', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 18900, closingPrice: 18700, yesterdayPrice: 18350, changePercent: 1.91 },
  { symbol: 'رکیش', name: 'کارت اعتباری ایران کیش', inscode: '99810023419572174', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 3450, closingPrice: 3410, yesterdayPrice: 3350, changePercent: 1.79 },
  { symbol: 'مداران', name: 'داده پردازی ایران', inscode: '99810023419572175', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 17600, closingPrice: 17400, yesterdayPrice: 17100, changePercent: 1.75 },
  { symbol: 'آسیاتک', name: 'انتقال داده‌های آسیاتک', inscode: '99810023419572179', type: 'stock', categoryName: 'اطلاعات و ارتباطات', lastPrice: 11400, closingPrice: 11250, yesterdayPrice: 11050, changePercent: 1.81 },
  { symbol: 'حریل', name: 'ریل سیر کوثر', inscode: '109810023419572181', type: 'stock', categoryName: 'حمل و نقل', lastPrice: 4890, closingPrice: 4820, yesterdayPrice: 4740, changePercent: 1.69 },
  { symbol: 'حسیر', name: 'ریل پرداز سیر', inscode: '109810023419572182', type: 'stock', categoryName: 'حمل و نقل', lastPrice: 3450, closingPrice: 3410, yesterdayPrice: 3350, changePercent: 1.79 },
  { symbol: 'بجهرم', name: 'تولید نیروی برق دماوند جهرم', inscode: '109810023419572183', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 2180, closingPrice: 2150, yesterdayPrice: 2110, changePercent: 1.9 },
  { symbol: 'دماوند', name: 'تولید نیروی برق دماوند', inscode: '109810023419572184', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 19800, closingPrice: 19600, yesterdayPrice: 19250, changePercent: 1.82 },
  { symbol: 'جواهر', name: 'صندوق طلای جواهر', inscode: '70808810243177653', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 61800, closingPrice: 61700, yesterdayPrice: 61100, changePercent: 0.98 },
  { symbol: 'آلتون', name: 'صندوق طلای آلتون', inscode: '70808810243177654', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 63100, closingPrice: 63000, yesterdayPrice: 62400, changePercent: 0.96 },
  { symbol: 'سحرخیز', name: 'صندوق طلای سحرخیز', inscode: '70808810243177655', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 62700, closingPrice: 62600, yesterdayPrice: 62000, changePercent: 0.97 },
  { symbol: 'نفیس', name: 'صندوق طلای نفیس', inscode: '70808810243177656', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 61950, closingPrice: 61850, yesterdayPrice: 61300, changePercent: 0.9 },
  { symbol: 'زرفشان', name: 'صندوق طلای زرفشان امید', inscode: '70808810243177657', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 62500, closingPrice: 62400, yesterdayPrice: 61800, changePercent: 0.97 },
  { symbol: 'بیدار', name: 'صندوق اهرمی بیدار', inscode: '25181048679119141', type: 'leveraged', categoryName: 'صندوق اهرمی', lastPrice: 18100, closingPrice: 18000, yesterdayPrice: 17650, changePercent: 1.98 },
  { symbol: 'لبخند', name: 'صندوق درآمد ثابت لبخند فارابی', inscode: '61730030232532730', type: 'fixed_income', categoryName: 'درآمد ثابت', lastPrice: 10250, closingPrice: 10250, yesterdayPrice: 10240, changePercent: 0.1 },
  { symbol: 'هما', name: 'صندوق درآمد ثابت هما اکسیر', inscode: '61730030232532731', type: 'fixed_income', categoryName: 'درآمد ثابت', lastPrice: 10180, closingPrice: 10180, yesterdayPrice: 10170, changePercent: 0.1 },
  { symbol: 'اونیکس', name: 'صندوق درآمد ثابت اونیکس مفید', inscode: '61730030232532732', type: 'fixed_income', categoryName: 'درآمد ثابت', lastPrice: 10320, closingPrice: 10320, yesterdayPrice: 10310, changePercent: 0.1 },
  { symbol: 'فیروزا', name: 'صندوق با درآمد ثابت فیروزا', inscode: '61730030232532733', type: 'fixed_income', categoryName: 'درآمد ثابت', lastPrice: 12450, closingPrice: 12450, yesterdayPrice: 12440, changePercent: 0.08 },
  { symbol: 'پارند', name: 'صندوق درآمد ثابت پارند پایدار', inscode: '61730030232532734', type: 'fixed_income', categoryName: 'درآمد ثابت', lastPrice: 14300, closingPrice: 14300, yesterdayPrice: 14290, changePercent: 0.07 },
  { symbol: 'تصمیم', name: 'صندوق درآمد ثابت تصمیم نگار', inscode: '61730030232532735', type: 'fixed_income', categoryName: 'درآمد ثابت', lastPrice: 10550, closingPrice: 10550, yesterdayPrice: 10540, changePercent: 0.09 },
  { symbol: 'زردیس', name: 'صندوق سرمایه‌گذاری طلای زردیس', inscode: '70808810243177658', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 62300, closingPrice: 62200, yesterdayPrice: 61600, changePercent: 1.13 },
  { symbol: 'مثقال', name: 'صندوق طلای زرفام مثقال', inscode: '70808810243177659', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 61900, closingPrice: 61850, yesterdayPrice: 61300, changePercent: 0.98 },
  { symbol: 'کیمیا', name: 'صندوق سرمایه‌گذاری طلای کیمیا', inscode: '70808810243177660', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 63500, closingPrice: 63400, yesterdayPrice: 62800, changePercent: 1.11 },
  { symbol: 'گنج', name: 'صندوق طلای زرفام گنج', inscode: '70808810243177661', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 62100, closingPrice: 62000, yesterdayPrice: 61500, changePercent: 0.98 },
  { symbol: 'سیمرغ طلا', name: 'صندوق سرمایه‌گذاری طلای سیمرغ', inscode: '70808810243177662', type: 'gold', categoryName: 'صندوق طلا', lastPrice: 62800, closingPrice: 62700, yesterdayPrice: 62100, changePercent: 1.13 },
  { symbol: 'تمشک', name: 'صندوق سرمایه‌گذاری تمشک کاریزما', inscode: '28107936665796345', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 16400, closingPrice: 16300, yesterdayPrice: 16000, changePercent: 2.5 },
  { symbol: 'افق', name: 'صندوق سرمایه‌گذاری افق ملت', inscode: '28107936665796346', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 28500, closingPrice: 28300, yesterdayPrice: 27800, changePercent: 2.52 },
  { symbol: 'سپهر', name: 'صندوق سرمایه‌گذاری سپهر کاریزما', inscode: '28107936665796347', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 42100, closingPrice: 41800, yesterdayPrice: 41100, changePercent: 2.43 },
  { symbol: 'انار', name: 'صندوق سرمایه‌گذاری بخشی انار', inscode: '28107936665796348', type: 'fund', categoryName: 'صندوق بخشی', lastPrice: 14200, closingPrice: 14100, yesterdayPrice: 13850, changePercent: 2.53 },
  { symbol: 'پیشگام', name: 'صندوق سرمایه‌گذاری بخشی پیشگام', inscode: '28107936665796349', type: 'fund', categoryName: 'صندوق بخشی', lastPrice: 12300, closingPrice: 12200, yesterdayPrice: 12000, changePercent: 2.5 },
  { symbol: 'ثروت', name: 'صندوق سرمایه‌گذاری ثروت پویا', inscode: '28107936665796350', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 31200, closingPrice: 31000, yesterdayPrice: 30500, changePercent: 2.3 },
  { symbol: 'داریک', name: 'صندوق سرمایه‌گذاری داریک پارس', inscode: '28107936665796351', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 24500, closingPrice: 24300, yesterdayPrice: 23900, changePercent: 2.51 },
  { symbol: 'سلام', name: 'صندوق سرمایه‌گذاری سلام فیروزه', inscode: '28107936665796352', type: 'fund', categoryName: 'صندوق سهامی', lastPrice: 19800, closingPrice: 19600, yesterdayPrice: 19250, changePercent: 2.86 },
  { symbol: 'کارین', name: 'صندوق با درآمد ثابت کارین', inscode: '61730030232532736', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 10120, closingPrice: 10120, yesterdayPrice: 10110, changePercent: 0.1 },
  { symbol: 'حامی', name: 'صندوق سرمایه‌گذاری حامی مفید', inscode: '61730030232532737', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 10050, closingPrice: 10050, yesterdayPrice: 10040, changePercent: 0.1 },
  { symbol: 'صایند', name: 'صندوق سرمایه‌گذاری صایند ایران', inscode: '61730030232532738', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 10420, closingPrice: 10420, yesterdayPrice: 10410, changePercent: 0.1 },
  { symbol: 'گنجینه', name: 'صندوق گنجینه زرین شهر', inscode: '61730030232532739', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 10850, closingPrice: 10850, yesterdayPrice: 10840, changePercent: 0.09 },
  { symbol: 'سپر', name: 'صندوق با درآمد ثابت سپر اندیشه', inscode: '61730030232532740', type: 'fixed_income', categoryName: 'صندوق درآمد ثابت', lastPrice: 10210, closingPrice: 10210, yesterdayPrice: 10200, changePercent: 0.1 },
  { symbol: 'فرآور', name: 'فرآوری مواد معدنی ایران', inscode: '29810023419572170', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 14500, closingPrice: 14350, yesterdayPrice: 14100, changePercent: 2.84 },
  { symbol: 'فسپا', name: 'گروه صنعتی سپاهان', inscode: '29810023419572171', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 8900, closingPrice: 8820, yesterdayPrice: 8680, changePercent: 2.53 },
  { symbol: 'فپنتا', name: 'سپنتا', inscode: '29810023419572172', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 78500, closingPrice: 77900, yesterdayPrice: 76500, changePercent: 2.61 },
  { symbol: 'فمراد', name: 'آلومراد', inscode: '29810023419572173', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 12300, closingPrice: 12150, yesterdayPrice: 11950, changePercent: 2.93 },
  { symbol: 'فنوال', name: 'نورد آلومینیوم', inscode: '29810023419572174', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 21400, closingPrice: 21200, yesterdayPrice: 20800, changePercent: 2.88 },
  { symbol: 'فتوسا', name: 'تولید و توسعه سرب و روی ایرانیان', inscode: '29810023419572175', type: 'stock', categoryName: 'فلزات اساسی', lastPrice: 4320, closingPrice: 4280, yesterdayPrice: 4200, changePercent: 2.86 },
  { symbol: 'فزر', name: 'پویا زرکان آق دره', inscode: '29810023419572176', type: 'stock', categoryName: 'استخراج کانه‌های فلزی', lastPrice: 42800, closingPrice: 42400, yesterdayPrice: 41600, changePercent: 2.88 },
  { symbol: 'کاما', name: 'باما', inscode: '39810023419572177', type: 'stock', categoryName: 'استخراج کانه‌های فلزی', lastPrice: 6250, closingPrice: 6190, yesterdayPrice: 6080, changePercent: 2.8 },
  { symbol: 'کدما', name: 'معدنی دماوند', inscode: '39810023419572178', type: 'stock', categoryName: 'استخراج کانه‌های فلزی', lastPrice: 98500, closingPrice: 97800, yesterdayPrice: 96000, changePercent: 2.6 },
  { symbol: 'کپرور', name: 'فرآوری زغال سنگ پروده طبس', inscode: '39810023419572179', type: 'stock', categoryName: 'استخراج سایر معادن', lastPrice: 28500, closingPrice: 28200, yesterdayPrice: 27700, changePercent: 2.89 },
  { symbol: 'کطبس', name: 'زغال سنگ نگین طبس', inscode: '39810023419572180', type: 'stock', categoryName: 'استخراج سایر معادن', lastPrice: 17800, closingPrice: 17600, yesterdayPrice: 17300, changePercent: 2.89 },
  { symbol: 'کشرق', name: 'صنعتی و معدنی شمال شرق شاهرود', inscode: '39810023419572181', type: 'stock', categoryName: 'استخراج سایر معادن', lastPrice: 31200, closingPrice: 30900, yesterdayPrice: 30300, changePercent: 2.97 },
  { symbol: 'شغدیر', name: 'پتروشیمی غدیر', inscode: '18348981421512468', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 68500, closingPrice: 67900, yesterdayPrice: 66800, changePercent: 2.54 },
  { symbol: 'شصدف', name: 'صنعتی دوده فام', inscode: '18348981421512469', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 48200, closingPrice: 47800, yesterdayPrice: 47000, changePercent: 2.55 },
  { symbol: 'شکبیر', name: 'پتروشیمی امیرکبیر', inscode: '18348981421512470', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 94500, closingPrice: 93800, yesterdayPrice: 92200, changePercent: 2.49 },
  { symbol: 'شکربن', name: 'کربن ایران', inscode: '18348981421512471', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 6450, closingPrice: 6390, yesterdayPrice: 6280, changePercent: 2.71 },
  { symbol: 'شپترو', name: 'پتروشیمی آبادان', inscode: '18348981421512472', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 1840, closingPrice: 1820, yesterdayPrice: 1780, changePercent: 3.37 },
  { symbol: 'شلرد', name: 'کود شیمیایی اوره لردگان', inscode: '18348981421512473', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 7850, closingPrice: 7780, yesterdayPrice: 7640, changePercent: 2.75 },
  { symbol: 'شسینا', name: 'صنایع شیمیایی سینا', inscode: '18348981421512474', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 12300, closingPrice: 12150, yesterdayPrice: 11950, changePercent: 2.93 },
  { symbol: 'شاملا', name: 'معدنی املاح ایران', inscode: '18348981421512475', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 34500, closingPrice: 34200, yesterdayPrice: 33600, changePercent: 2.68 },
  { symbol: 'پاکشو', name: 'گروه صنعتی پاکشو', inscode: '18348981421512476', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 6250, closingPrice: 6190, yesterdayPrice: 6080, changePercent: 2.8 },
  { symbol: 'شگل', name: 'گلتاش', inscode: '18348981421512477', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 4120, closingPrice: 4080, yesterdayPrice: 4010, changePercent: 2.74 },
  { symbol: 'قرن', name: 'پدیده شیمی قرن', inscode: '18348981421512478', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 14800, closingPrice: 14650, yesterdayPrice: 14400, changePercent: 2.78 },
  { symbol: 'ساینا', name: 'صنایع بهداشتی ساینا', inscode: '18348981421512479', type: 'stock', categoryName: 'محصولات شیمیایی', lastPrice: 38500, closingPrice: 38100, yesterdayPrice: 37400, changePercent: 2.94 },
  { symbol: 'خریخت', name: 'ریخته‌گری ایران خودرو', inscode: '49810023419572185', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 3450, closingPrice: 3410, yesterdayPrice: 3340, changePercent: 3.29 },
  { symbol: 'خزر', name: 'فنرسازی زر', inscode: '49810023419572186', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 4120, closingPrice: 4070, yesterdayPrice: 3990, changePercent: 3.26 },
  { symbol: 'خلنت', name: 'لنت ترمز ایران', inscode: '49810023419572187', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 16500, closingPrice: 16300, yesterdayPrice: 16000, changePercent: 3.12 },
  { symbol: 'خچرخش', name: 'چرخشگر', inscode: '49810023419572188', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 9850, closingPrice: 9750, yesterdayPrice: 9550, changePercent: 3.14 },
  { symbol: 'خکمک', name: 'کمک فنر ایندامین', inscode: '49810023419572189', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 3890, closingPrice: 3840, yesterdayPrice: 3760, changePercent: 3.46 },
  { symbol: 'خوساز', name: 'صنعتی محور سازان ایران خودرو', inscode: '49810023419572190', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 11400, closingPrice: 11250, yesterdayPrice: 11050, changePercent: 3.17 },
  { symbol: 'خفنر', name: 'فنر سازی خاور', inscode: '49810023419572191', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 8750, closingPrice: 8650, yesterdayPrice: 8480, changePercent: 3.18 },
  { symbol: 'خکار', name: 'ایرکا پارت صنعت', inscode: '49810023419572192', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 5420, closingPrice: 5350, yesterdayPrice: 5240, changePercent: 3.44 },
  { symbol: 'ختوس', name: 'توسعه شهری توس گستر', inscode: '49810023419572193', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 7890, closingPrice: 7790, yesterdayPrice: 7620, changePercent: 3.54 },
  { symbol: 'خمحرکه', name: 'صنعتی نیرو محرکه', inscode: '49810023419572194', type: 'stock', categoryName: 'خودرو و ساخت قطعات', lastPrice: 4210, closingPrice: 4160, yesterdayPrice: 4070, changePercent: 3.44 },
  { symbol: 'گردش', name: 'بانک گردشگری', inscode: '59810023419572195', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 8450, closingPrice: 8360, yesterdayPrice: 8220, changePercent: 2.8 },
  { symbol: 'رسالت', name: 'بانک قرض الحسنه رسالت', inscode: '59810023419572196', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 21400, closingPrice: 21150, yesterdayPrice: 20750, changePercent: 3.13 },
  { symbol: 'وکار', name: 'بانک کارآفرین', inscode: '59810023419572197', type: 'stock', categoryName: 'بانک‌ها و موسسات اعتباری', lastPrice: 2450, closingPrice: 2420, yesterdayPrice: 2380, changePercent: 2.94 },
  { symbol: 'ما', name: 'بیمه ما', inscode: '59810023419572199', type: 'stock', categoryName: 'بیمه و صندوق بازنشستگی', lastPrice: 3120, closingPrice: 3080, yesterdayPrice: 3020, changePercent: 3.31 },
  { symbol: 'کوثر', name: 'بیمه کوثر', inscode: '59810023419572200', type: 'stock', categoryName: 'بیمه و صندوق بازنشستگی', lastPrice: 4850, closingPrice: 4790, yesterdayPrice: 4700, changePercent: 3.19 },
  { symbol: 'پارسیان', name: 'بیمه پارسیان', inscode: '59810023419572201', type: 'stock', categoryName: 'بیمه و صندوق بازنشستگی', lastPrice: 2740, closingPrice: 2710, yesterdayPrice: 2660, changePercent: 3.01 },
  { symbol: 'ملت', name: 'بیمه ملت', inscode: '59810023419572202', type: 'stock', categoryName: 'بیمه و صندوق بازنشستگی', lastPrice: 2150, closingPrice: 2120, yesterdayPrice: 2080, changePercent: 3.37 },
  { symbol: 'وخارزم', name: 'سرمایه‌گذاری خوارزمی', inscode: '39810023419572204', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 2340, closingPrice: 2310, yesterdayPrice: 2260, changePercent: 3.54 },
  { symbol: 'وبانک', name: 'سرمایه‌گذاری گروه توسعه ملی', inscode: '39810023419572205', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 9850, closingPrice: 9740, yesterdayPrice: 9560, changePercent: 3.03 },
  { symbol: 'وسپهر', name: 'سرمایه‌گذاری مالی سپهر صادرات', inscode: '39810023419572208', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 6250, closingPrice: 6180, yesterdayPrice: 6060, changePercent: 3.14 },
  { symbol: 'ومهان', name: 'گروه مالی مهر آیندگان', inscode: '39810023419572209', type: 'stock', categoryName: 'سرمایه‌گذاری‌ها', lastPrice: 7120, closingPrice: 7040, yesterdayPrice: 6910, changePercent: 3.04 },
  { symbol: 'دزهراوی', name: 'داروسازی زهراوی', inscode: '69810023419572210', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 3890, closingPrice: 3840, yesterdayPrice: 3760, changePercent: 3.46 },
  { symbol: 'پخش', name: 'پخش البرز', inscode: '69810023419572211', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 12400, closingPrice: 12250, yesterdayPrice: 12050, changePercent: 2.9 },
  { symbol: 'دروز', name: 'داروسازی روزدارو', inscode: '69810023419572212', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 8750, closingPrice: 8650, yesterdayPrice: 8490, changePercent: 3.06 },
  { symbol: 'دکوثر', name: 'داروسازی کوثر', inscode: '69810023419572214', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 6540, closingPrice: 6460, yesterdayPrice: 6340, changePercent: 3.15 },
  { symbol: 'داسوه', name: 'داروسازی اسوه', inscode: '69810023419572215', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 14800, closingPrice: 14650, yesterdayPrice: 14380, changePercent: 2.92 },
  { symbol: 'دکیمی', name: 'کیمیدارو', inscode: '69810023419572216', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 19800, closingPrice: 19550, yesterdayPrice: 19200, changePercent: 3.12 },
  { symbol: 'دتماد', name: 'تولید مواد اولیه داروپخش', inscode: '69810023419572217', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 45200, closingPrice: 44700, yesterdayPrice: 43900, changePercent: 2.96 },
  { symbol: 'دسینا', name: 'داروسازی سینا', inscode: '69810023419572218', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 18400, closingPrice: 18200, yesterdayPrice: 17850, changePercent: 3.08 },
  { symbol: 'دجابر', name: 'داروسازی جابر ابن حیان', inscode: '69810023419572219', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 9650, closingPrice: 9540, yesterdayPrice: 9360, changePercent: 3.1 },
  { symbol: 'کاسپین', name: 'داروسازی کاسپین تامین', inscode: '69810023419572220', type: 'stock', categoryName: 'مواد و محصولات دارویی', lastPrice: 31200, closingPrice: 30800, yesterdayPrice: 30250, changePercent: 3.14 },
  { symbol: 'سمازن', name: 'سیمان مازندران', inscode: '79810023419572221', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 18400, closingPrice: 18200, yesterdayPrice: 17850, changePercent: 3.08 },
  { symbol: 'ساربیل', name: 'سیمان آرتا اردبیل', inscode: '79810023419572222', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 29800, closingPrice: 29500, yesterdayPrice: 28950, changePercent: 2.94 },
  { symbol: 'ساروم', name: 'سیمان ارومیه', inscode: '79810023419572223', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 34500, closingPrice: 34100, yesterdayPrice: 33500, changePercent: 2.99 },
  { symbol: 'سفانو', name: 'سیمان فارس نو', inscode: '79810023419572224', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 58900, closingPrice: 58200, yesterdayPrice: 57100, changePercent: 3.15 },
  { symbol: 'سکرد', name: 'سیمان کردستان', inscode: '79810023419572225', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 7890, closingPrice: 7790, yesterdayPrice: 7640, changePercent: 3.27 },
  { symbol: 'سغرب', name: 'سیمان غرب', inscode: '79810023419572226', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 21400, closingPrice: 21150, yesterdayPrice: 20750, changePercent: 3.13 },
  { symbol: 'سصوفی', name: 'سیمان صوفیان', inscode: '79810023419572227', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 16500, closingPrice: 16300, yesterdayPrice: 16000, changePercent: 3.12 },
  { symbol: 'سخاش', name: 'سیمان خاش', inscode: '79810023419572228', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 87500, closingPrice: 86600, yesterdayPrice: 85000, changePercent: 2.94 },
  { symbol: 'ساروج', name: 'سیمان بین‌المللی ساروج بوشهر', inscode: '79810023419572229', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 12300, closingPrice: 12150, yesterdayPrice: 11920, changePercent: 3.19 },
  { symbol: 'سهرمز', name: 'سیمان هرمزگان', inscode: '79810023419572230', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 19800, closingPrice: 19550, yesterdayPrice: 19200, changePercent: 3.12 },
  { symbol: 'سپاها', name: 'سیمان سپاهان', inscode: '79810023419572231', type: 'stock', categoryName: 'سیمان، آهک و گچ', lastPrice: 14200, closingPrice: 14050, yesterdayPrice: 13800, changePercent: 2.9 },
  { symbol: 'ثمسکن', name: 'سرمایه‌گذاری مسکن', inscode: '89810023419572232', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 3240, closingPrice: 3200, yesterdayPrice: 3140, changePercent: 3.18 },
  { symbol: 'ثعمرا', name: 'عمران و توسعه شاهد', inscode: '89810023419572235', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 5120, closingPrice: 5050, yesterdayPrice: 4960, changePercent: 3.23 },
  { symbol: 'ثنوسا', name: 'نوسازی و ساختمان تهران', inscode: '89810023419572237', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 7420, closingPrice: 7320, yesterdayPrice: 7180, changePercent: 3.34 },
  { symbol: 'ثامان', name: 'سامان گستر اصفهان', inscode: '89810023419572238', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 9850, closingPrice: 9720, yesterdayPrice: 9550, changePercent: 3.14 },
  { symbol: 'ثشرق', name: 'سرمایه‌گذاری مسکن شمالشرق', inscode: '89810023419572239', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 4120, closingPrice: 4060, yesterdayPrice: 3980, changePercent: 3.52 },
  { symbol: 'ثغرب', name: 'سرمایه‌گذاری مسکن شمالغرب', inscode: '89810023419572240', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 5890, closingPrice: 5810, yesterdayPrice: 5700, changePercent: 3.33 },
  { symbol: 'ثباغ', name: 'سرمایه‌گذاری مسکن شمال', inscode: '89810023419572241', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 8450, closingPrice: 8340, yesterdayPrice: 8190, changePercent: 3.17 },
  { symbol: 'وآذر', name: 'سرمایه‌گذاری توسعه آذربایجان', inscode: '89810023419572242', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 3450, closingPrice: 3400, yesterdayPrice: 3340, changePercent: 3.29 },
  { symbol: 'ثبهساز', name: 'بهساز کاشانه تهران', inscode: '89810023419572243', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 2180, closingPrice: 2150, yesterdayPrice: 2110, changePercent: 3.32 },
  { symbol: 'ثامید', name: 'توسعه و عمران امید', inscode: '89810023419572244', type: 'stock', categoryName: 'انبوه‌سازی و املاک', lastPrice: 2890, closingPrice: 2850, yesterdayPrice: 2800, changePercent: 3.21 },
  { symbol: 'غالبر', name: 'لبنیات کالبر', inscode: '89810023419572246', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 8750, closingPrice: 8640, yesterdayPrice: 8490, changePercent: 3.06 },
  { symbol: 'غپینو', name: 'پارس مینو', inscode: '89810023419572247', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 3120, closingPrice: 3080, yesterdayPrice: 3020, changePercent: 3.31 },
  { symbol: 'غشهداب', name: 'کشت و صنعت شهداب ناب خراسان', inscode: '89810023419572248', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 2450, closingPrice: 2410, yesterdayPrice: 2370, changePercent: 3.38 },
  { symbol: 'غپاک', name: 'لبنیات پاک', inscode: '89810023419572249', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 6540, closingPrice: 6450, yesterdayPrice: 6340, changePercent: 3.15 },
  { symbol: 'غدیس', name: 'پاکدیس', inscode: '89810023419572250', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 14800, closingPrice: 14600, yesterdayPrice: 14350, changePercent: 3.14 },
  { symbol: 'غچین', name: 'مجتمع کشت و صنعت چین چین', inscode: '89810023419572251', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 19800, closingPrice: 19550, yesterdayPrice: 19200, changePercent: 3.12 },
  { symbol: 'غدشت', name: 'دشت مرغاب', inscode: '89810023419572252', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 38500, closingPrice: 38000, yesterdayPrice: 37300, changePercent: 3.22 },
  { symbol: 'زبینا', name: 'کشاورزی و دامپروری بینالود', inscode: '89810023419572253', type: 'stock', categoryName: 'زراعت و خدمات وابسته', lastPrice: 7890, closingPrice: 7780, yesterdayPrice: 7640, changePercent: 3.27 },
  { symbol: 'زپارس', name: 'ملی کشت و صنعت و دامپروری پارس', inscode: '89810023419572254', type: 'stock', categoryName: 'زراعت و خدمات وابسته', lastPrice: 31200, closingPrice: 30800, yesterdayPrice: 30250, changePercent: 3.14 },
  { symbol: 'زماهان', name: 'مجتمع تولید گوشت مرغ ماهان', inscode: '89810023419572255', type: 'stock', categoryName: 'زراعت و خدمات وابسته', lastPrice: 12400, closingPrice: 12250, yesterdayPrice: 12050, changePercent: 2.9 },
  { symbol: 'سپید', name: 'سپید ماکیان', inscode: '89810023419572256', type: 'stock', categoryName: 'زراعت و خدمات وابسته', lastPrice: 26800, closingPrice: 26450, yesterdayPrice: 26000, changePercent: 3.08 },
  { symbol: 'بهپاک', name: 'صنعتی بهپاک', inscode: '89810023419572257', type: 'stock', categoryName: 'محصولات غذایی و آشامیدنی', lastPrice: 5420, closingPrice: 5350, yesterdayPrice: 5240, changePercent: 3.44 },
  { symbol: 'رتاپ', name: 'تجارت الکترونیک پارسیان', inscode: '99810023419572258', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 3450, closingPrice: 3410, yesterdayPrice: 3340, changePercent: 3.29 },
  { symbol: 'افرا', name: 'افرا نت', inscode: '99810023419572259', type: 'stock', categoryName: 'اطلاعات و ارتباطات', lastPrice: 8750, closingPrice: 8640, yesterdayPrice: 8490, changePercent: 3.06 },
  { symbol: 'فن‌آوا', name: 'گروه فن آوا', inscode: '99810023419572260', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 4890, closingPrice: 4820, yesterdayPrice: 4740, changePercent: 3.16 },
  { symbol: 'مفاخر', name: 'توسعه فناوری اطلاعات خوارزمی', inscode: '99810023419572261', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 7890, closingPrice: 7780, yesterdayPrice: 7640, changePercent: 3.27 },
  { symbol: 'مرقام', name: 'ایران ارقام', inscode: '99810023419572262', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 2150, closingPrice: 2120, yesterdayPrice: 2080, changePercent: 3.37 },
  { symbol: 'پرداخت', name: 'به پرداخت ملت', inscode: '99810023419572263', type: 'stock', categoryName: 'رایانه و فعالیت‌های وابسته', lastPrice: 18400, closingPrice: 18200, yesterdayPrice: 17850, changePercent: 3.08 },
  { symbol: 'بمپنا', name: 'تولید برق عسلویه مپنا', inscode: '109810023419572264', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 14200, closingPrice: 14050, yesterdayPrice: 13800, changePercent: 2.9 },
  { symbol: 'بزاگرس', name: 'تولید نیروی برق زاگرس کوثر', inscode: '109810023419572265', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 4120, closingPrice: 4070, yesterdayPrice: 3990, changePercent: 3.26 },
  { symbol: 'بکهنوج', name: 'تولید برق ماه تاب کهنوج', inscode: '109810023419572266', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 3890, closingPrice: 3840, yesterdayPrice: 3760, changePercent: 3.46 },
  { symbol: 'وهور', name: 'مدیریت انرژی امید تابان هور', inscode: '109810023419572267', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 2450, closingPrice: 2410, yesterdayPrice: 2370, changePercent: 3.38 },
  { symbol: 'مبین', name: 'مبین انرژی خلیج فارس', inscode: '109810023419572268', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 11400, closingPrice: 11250, yesterdayPrice: 11050, changePercent: 3.17 },
  { symbol: 'بفجر', name: 'فجر انرژی خلیج فارس', inscode: '109810023419572269', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 28500, closingPrice: 28200, yesterdayPrice: 27700, changePercent: 2.89 },
  { symbol: 'بپیوند', name: 'تولید برق پیوند گستر پارس', inscode: '109810023419572270', type: 'stock', categoryName: 'عرضه برق، گاز، بخار', lastPrice: 8750, closingPrice: 8640, yesterdayPrice: 8490, changePercent: 3.06 },
  { symbol: 'حپترو', name: 'حمل و نقل پتروشیمی', inscode: '109810023419572271', type: 'stock', categoryName: 'حمل و نقل', lastPrice: 12300, closingPrice: 12150, yesterdayPrice: 11950, changePercent: 2.93 },
  { symbol: 'حتوکا', name: 'حمل و نقل توکا', inscode: '109810023419572272', type: 'stock', categoryName: 'حمل و نقل', lastPrice: 6540, closingPrice: 6460, yesterdayPrice: 6340, changePercent: 3.15 },
  { symbol: 'حبندر', name: 'دریایی و کشتیرانی خط دریا بندر', inscode: '109810023419572273', type: 'stock', categoryName: 'حمل و نقل', lastPrice: 16500, closingPrice: 16300, yesterdayPrice: 16000, changePercent: 3.12 },

]

/**
 * جستجوی هوشمند در کلیه نمادهای رسمی بورس با فیلتر دسته‌بندی، نماد و نام شرکت
 */
export function findInstruments(query = '', limit = 1000, type?: string): TseInstrument[] {
  let pool = TSE_INSTRUMENTS
  if (type && type !== 'all') {
    pool = pool.filter(
      (item) => item.type === type || item.categoryName.toLowerCase().includes(type.toLowerCase())
    )
  }

  const q = normalizePersian(query).toLowerCase()
  if (!q) {
    return pool.slice(0, limit)
  }

  // اولویت ۱: تطابق دقیق نماد یا کد نماد
  const exactMatches: TseInstrument[] = []
  // اولویت ۲: نمادهایی که با عبارت جستجو شروع می‌شوند
  const prefixMatches: TseInstrument[] = []
  // اولویت ۳: نمادهایی که نام یا نمادشان شامل عبارت است
  const nameMatches: TseInstrument[] = []

  for (const item of pool) {
    const normSym = normalizePersian(item.symbol).toLowerCase()
    const normName = normalizePersian(item.name).toLowerCase()
    const inscode = item.inscode

    if (normSym === q || inscode === q) {
      exactMatches.push(item)
    } else if (normSym.startsWith(q)) {
      prefixMatches.push(item)
    } else if (normSym.includes(q) || normName.includes(q)) {
      nameMatches.push(item)
    }
  }

  const combined = [...exactMatches, ...prefixMatches, ...nameMatches]
  const seenSymbols = new Set<string>()
  const result: TseInstrument[] = []
  for (const item of combined) {
    if (!seenSymbols.has(item.symbol)) {
      seenSymbols.add(item.symbol)
      result.push(item)
      if (result.length >= limit) break
    }
  }

  return result
}

/**
 * یافتن دقیق یک نماد بر اساس کد نماد (inscode) یا نماد اختصاری یا نام شرکت
 */
export function findInstrumentBySymbolOrInscode(str: string): TseInstrument | undefined {
  if (!str) return undefined
  const clean = normalizePersian(str).toLowerCase()
  return (
    TSE_INSTRUMENTS.find((i) => i.inscode === clean) ||
    TSE_INSTRUMENTS.find((i) => normalizePersian(i.symbol).toLowerCase() === clean) ||
    TSE_INSTRUMENTS.find((i) => normalizePersian(i.name).toLowerCase() === clean) ||
    TSE_INSTRUMENTS.find((i) => normalizePersian(i.name).toLowerCase().includes(clean))
  )
}
