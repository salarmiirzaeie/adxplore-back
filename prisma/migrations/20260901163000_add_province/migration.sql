-- AlterTable
ALTER TABLE "User" ADD COLUMN "province" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "province" TEXT;

-- Backfill province for the previous short city list (unique names).
UPDATE "User" SET "province" = CASE "city"
  WHEN 'تهران' THEN 'تهران'
  WHEN 'کرج' THEN 'البرز'
  WHEN 'اصفهان' THEN 'اصفهان'
  WHEN 'مشهد' THEN 'خراسان رضوی'
  WHEN 'شیراز' THEN 'فارس'
  WHEN 'تبریز' THEN 'آذربایجان شرقی'
  WHEN 'اهواز' THEN 'خوزستان'
  WHEN 'قم' THEN 'قم'
  WHEN 'کرمان' THEN 'کرمان'
  WHEN 'رشت' THEN 'گیلان'
  WHEN 'یزد' THEN 'یزد'
  WHEN 'همدان' THEN 'همدان'
  WHEN 'ارومیه' THEN 'آذربایجان غربی'
  WHEN 'کرمانشاه' THEN 'کرمانشاه'
  WHEN 'بندرعباس' THEN 'هرمزگان'
  ELSE "province"
END;

UPDATE "Campaign" SET "province" = CASE "city"
  WHEN 'تهران' THEN 'تهران'
  WHEN 'کرج' THEN 'البرز'
  WHEN 'اصفهان' THEN 'اصفهان'
  WHEN 'مشهد' THEN 'خراسان رضوی'
  WHEN 'شیراز' THEN 'فارس'
  WHEN 'تبریز' THEN 'آذربایجان شرقی'
  WHEN 'اهواز' THEN 'خوزستان'
  WHEN 'قم' THEN 'قم'
  WHEN 'کرمان' THEN 'کرمان'
  WHEN 'رشت' THEN 'گیلان'
  WHEN 'یزد' THEN 'یزد'
  WHEN 'همدان' THEN 'همدان'
  WHEN 'ارومیه' THEN 'آذربایجان غربی'
  WHEN 'کرمانشاه' THEN 'کرمانشاه'
  WHEN 'بندرعباس' THEN 'هرمزگان'
  ELSE "province"
END;
