// Service Worker بسيط وآمن: لا يخزّن شيئًا ولا يعترض الطلبات (كلها تذهب للشبكة كما هي).
// وجوده يجعل المنصة قابلة للتثبيت، ولا يمكن أن يُظهر نسخة قديمة أو يكسر Supabase.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
