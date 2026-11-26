// المنيو. لتغيير سعر أو إضافة صنف عدّل هذا الملف.
// img: اسم الصورة في مجلد img بدون .jpg (اختياري)
// السكر يطلع لكل مشروب، إلا اللي عليه noOpt: 1 (القهوة السادة والحلى).
window.JOCKEY_MENU = {
  options: {
    sugar: { n: 'السكر', req: true, choices: [['بدون سكر', 0], ['خفيف', 0], ['وسط', 0], ['زيادة', 0]] }
  },
  cats: [
    { id: 'sig', n: 'المشروبات المميزة', s: 'توقيع JOCKEY' },
    { id: 'black', n: 'المشروبات السوداء', s: 'قهوة مختصة بدون حليب' },
    { id: 'milk', n: 'المشروبات بالحليب', s: 'إسبريسو مع حليب' },
    { id: 'sweet', n: 'الحلى', s: 'يمشي مع أي فنجان' }
  ],
  items: [
    { id: 'iced', c: 'sig', n: 'آيس JOCKEY', en: 'Iced Jockey', d: 'مشروب الكافيه المميز.', p: 24, img: 'iced' },
    { id: 'mat', c: 'sig', n: 'ماتشا', en: 'Matcha', p: 24, img: 'matcha' },
    { id: 'fredS', c: 'sig', n: 'إسبريسو الفريدو', en: 'Espresso Freddo', p: 16 },
    { id: 'esp', c: 'black', n: 'إسبريسو', en: 'Espresso', d: 'شوت إسبريسو مركز.', p: 12, img: 'espresso', noOpt: 1 },
    { id: 'amer', c: 'black', n: 'أمريكانو', en: 'Americano', p: 14 },
    { id: 'iamer', c: 'black', n: 'أمريكانو بارد', en: 'Iced Americano', p: 15 },
    { id: 'fred', c: 'black', n: 'إسبريسو الفريدو', en: 'Espresso Freddo', p: 18 },
    { id: 'cod', c: 'black', n: 'قهوة اليوم', en: 'Coffee of the Day', p: 11, noOpt: 1 },
    { id: 'codl', c: 'black', n: 'قهوة اليوم كبير', en: 'Coffee of the Day (L)', p: 13, noOpt: 1 },
    { id: 'v60h', c: 'black', n: 'V60 حار', en: 'V60 Hot', p: 20, noOpt: 1 },
    { id: 'v60i', c: 'black', n: 'V60 بارد', en: 'V60 Iced', p: 21, noOpt: 1 },
    { id: 'cort', c: 'milk', n: 'كورتادو', en: 'Cortado', p: 14 },
    { id: 'mac', c: 'milk', n: 'ماكياتو', en: 'Macchiato', p: 14 },
    { id: 'flat', c: 'milk', n: 'فلات وايت', en: 'Flat White', p: 16 },
    { id: 'latte', c: 'milk', n: 'لاتيه (حار)', en: 'Latte (Hot)', p: 17 },
    { id: 'capp', c: 'milk', n: 'كابتشينو', en: 'Cappuccino', p: 18 },
    { id: 'ilatte', c: 'milk', n: 'آيس لاتيه', en: 'Iced Latte', p: 19 },
    { id: 'chz', c: 'sweet', n: 'تشيز مدريد', en: 'Madrid Cheesecake', d: 'تشيزكيك محروق الوجه، كريمي من الداخل.', p: 26, img: 'cheesecake', noOpt: 1 },
    { id: 'pecan', c: 'sweet', n: 'بيكان ميلت', en: 'Pecan Melt', d: 'كيكة بصوص الكراميل والبيكان.', p: 24, img: 'pecan', noOpt: 1 },
    { id: 'brw', c: 'sweet', n: 'تشيز مدريد براوني', en: 'Madrid Cheesecake Brownie', p: 26, noOpt: 1 },
    { id: 'rv', c: 'sweet', n: 'رد فلفت كوكيز', en: 'Red Velvet Cookies', p: 12, noOpt: 1 }
  ]
};
