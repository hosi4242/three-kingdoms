#!/bin/sh
# browser-test → android-apk-project/www 복사 (Mac/Linux용)
cd "$(dirname "$0")/.." || exit 1
rm -rf android-apk-project/www && mkdir -p android-apk-project/www
cp -r browser-test/. android-apk-project/www/
rm -f android-apk-project/www/README_KO.md android-apk-project/www/*.bat
echo "복사 완료. node tools/verify.mjs 로 검사하세요."
