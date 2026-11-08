# Studex - Academic Planner (Bilingual)

## نظرة عامة
Studex is a personal academic planner designed to help students organize their weekly study schedules, manage lessons, and track progress. This version features a polished bilingual interface (Arabic / English) built strictly with HTML5, CSS3, and Vanilla JavaScript.

## الإعداد والتشغيل
التطبيق يعمل كتطبيق ويب تقدمي (PWA) ثابت. لا حاجة لأدوات بناء.
1. Serve the files using any standard static web server (e.g., VS Code Live Server, python -m http.server).
2. Access the site via `http://localhost:<port>`.
3. To install as a PWA, ensure you are serving over HTTPS or localhost.

## هيكل البيانات وآلية الدمج
يتم حفظ البيانات محلياً باستخدام **IndexedDB**. 
عند استيراد جدول أسبوعي جديد (`.json`)، يستخدم Studex وضع الدمج (Merge Mode):
1. It iterates through the imported subjects and sessions.
2. For each session, it checks the local database using the unique `session.id`.
3. **إذا كانت موجودة مسبقاً:** It updates properties like `title`, `date`, and `duration`, but **preserves the local completion status** (Pending / Completed).
4. **إذا كانت جديدة:** It inserts it with the `pending` status.

## الدعم بدون إنترنت (PWA & Offline)
التطبيق قادر على العمل بالكامل بدون إنترنت من خلال Service Worker (`sw.js`) والذي يقوم بتخزين جميع الملفات الأساسية مؤقتاً.
