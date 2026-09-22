import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'en' | 'fr' | 'es' | 'it' | 'de' | 'tr' | 'zh' | 'ja' | 'ru';

export const appLanguages: { code: AppLanguage; label: string; locale: string }[] = [
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
  { code: 'es', label: 'Español', locale: 'es-ES' },
  { code: 'it', label: 'Italiano', locale: 'it-IT' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'tr', label: 'Türkçe', locale: 'tr-TR' },
  { code: 'zh', label: '简体中文', locale: 'zh-CN' },
  { code: 'ja', label: '日本語', locale: 'ja-JP' },
  { code: 'ru', label: 'Русский', locale: 'ru-RU' },
];

type PhraseRow = [string, string, string, string, string, string, string, string, string];

const rows: PhraseRow[] = [
  ['Discover', 'Découvrir', 'Descubrir', 'Scopri', 'Entdecken', 'Keşfet', '发现', '見つける', 'Обзор'],
  ['Community', 'Communauté', 'Comunidad', 'Comunità', 'Community', 'Topluluk', '社区', 'コミュニティ', 'Сообщество'],
  ['Matches', 'Connexions', 'Conexiones', 'Abbinamenti', 'Kontakte', 'Eşleşmeler', '匹配', 'マッチ', 'Совпадения'],
  ['Messages', 'Messages', 'Mensajes', 'Messaggi', 'Nachrichten', 'Mesajlar', '消息', 'メッセージ', 'Сообщения'],
  ['Profile', 'Profil', 'Perfil', 'Profilo', 'Profil', 'Profil', '个人资料', 'プロフィール', 'Профиль'],
  ['Settings', 'Paramètres', 'Ajustes', 'Impostazioni', 'Einstellungen', 'Ayarlar', '设置', '設定', 'Настройки'],
  ['Back', 'Retour', 'Atrás', 'Indietro', 'Zurück', 'Geri', '返回', '戻る', 'Назад'],
  ['Cancel', 'Annuler', 'Cancelar', 'Annulla', 'Abbrechen', 'İptal', '取消', 'キャンセル', 'Отмена'],
  ['Close', 'Fermer', 'Cerrar', 'Chiudi', 'Schließen', 'Kapat', '关闭', '閉じる', 'Закрыть'],
  ['Save', 'Enregistrer', 'Guardar', 'Salva', 'Speichern', 'Kaydet', '保存', '保存', 'Сохранить'],
  ['Delete', 'Supprimer', 'Eliminar', 'Elimina', 'Löschen', 'Sil', '删除', '削除', 'Удалить'],
  ['Reply', 'Répondre', 'Responder', 'Rispondi', 'Antworten', 'Yanıtla', '回复', '返信', 'Ответить'],
  ['More', 'Plus', 'Más', 'Altro', 'Mehr', 'Diğer', '更多', 'その他', 'Ещё'],
  ['Loading…', 'Chargement…', 'Cargando…', 'Caricamento…', 'Wird geladen…', 'Yükleniyor…', '正在加载…', '読み込み中…', 'Загрузка…'],
  ['Try again', 'Réessayer', 'Intentar de nuevo', 'Riprova', 'Erneut versuchen', 'Tekrar dene', '重试', 'もう一度試す', 'Повторить'],
  ['Refresh', 'Actualiser', 'Actualizar', 'Aggiorna', 'Aktualisieren', 'Yenile', '刷新', '更新', 'Обновить'],
  ['Sign in', 'Se connecter', 'Iniciar sesión', 'Accedi', 'Anmelden', 'Giriş yap', '登录', 'ログイン', 'Войти'],
  ['Create account', 'Créer un compte', 'Crear cuenta', 'Crea account', 'Konto erstellen', 'Hesap oluştur', '创建账户', 'アカウント作成', 'Создать аккаунт'],
  ['Sign out', 'Se déconnecter', 'Cerrar sesión', 'Esci', 'Abmelden', 'Çıkış yap', '退出登录', 'ログアウト', 'Выйти'],
  ['Email', 'E-mail', 'Correo electrónico', 'E-mail', 'E-Mail', 'E-posta', '电子邮箱', 'メール', 'Эл. почта'],
  ['Password', 'Mot de passe', 'Contraseña', 'Password', 'Passwort', 'Şifre', '密码', 'パスワード', 'Пароль'],
  ['Continue', 'Continuer', 'Continuar', 'Continua', 'Weiter', 'Devam et', '继续', '続ける', 'Продолжить'],
  ['YOUR ACADEMIC WORLD, BEYOND YOUR UNIVERSITY', 'VOTRE MONDE ACADÉMIQUE, AU-DELÀ DE VOTRE UNIVERSITÉ', 'TU MUNDO ACADÉMICO, MÁS ALLÁ DE TU UNIVERSIDAD', 'IL TUO MONDO ACCADEMICO, OLTRE L’UNIVERSITÀ', 'DEINE AKADEMISCHE WELT, ÜBER DIE UNIVERSITÄT HINAUS', 'ÜNİVERSİTENİN ÖTESİNDE AKADEMİK DÜNYAN', '超越校园的学术世界', '大学を越えて広がる学術の世界', 'ВАШ АКАДЕМИЧЕСКИЙ МИР ЗА ПРЕДЕЛАМИ УНИВЕРСИТЕТА'],
  ['Meet the researchers you should know.', 'Rencontrez les chercheurs que vous devriez connaître.', 'Conoce a los investigadores que deberías conocer.', 'Incontra i ricercatori che dovresti conoscere.', 'Lerne Forschende kennen, die du kennen solltest.', 'Tanışman gereken araştırmacılarla buluş.', '结识值得认识的研究人员。', '知っておくべき研究者と出会いましょう。', 'Познакомьтесь с исследователями, которых стоит знать.'],
  ['Research-based matches', 'Connexions fondées sur la recherche', 'Conexiones basadas en investigación', 'Abbinamenti basati sulla ricerca', 'Forschungsbasierte Kontakte', 'Araştırma odaklı eşleşmeler', '基于研究的匹配', '研究に基づくマッチング', 'Совпадения по исследованиям'],
  ['Relocation connections', 'Connexions pour la mobilité', 'Conexiones para mudanzas', 'Contatti per il trasferimento', 'Kontakte für den Umzug', 'Taşınma bağlantıları', '搬迁联系', '移住先でのつながり', 'Связи при переезде'],
  ['Early-career community', 'Communauté en début de carrière', 'Comunidad de inicio de carrera', 'Comunità a inizio carriera', 'Community für den Karrierestart', 'Kariyerinin başındakiler topluluğu', '职业早期社区', '若手研究者コミュニティ', 'Сообщество молодых специалистов'],
  ['Good afternoon', 'Bonjour', 'Buenas tardes', 'Buon pomeriggio', 'Guten Tag', 'İyi günler', '下午好', 'こんにちは', 'Добрый день'],
  ['Who should you know?', 'Qui devriez-vous connaître ?', '¿A quién deberías conocer?', 'Chi dovresti conoscere?', 'Wen solltest du kennen?', 'Kimleri tanımalısın?', '你应该认识谁？', '誰と出会うべき？', 'С кем стоит познакомиться?'],
  ['Research', 'Recherche', 'Investigación', 'Ricerca', 'Forschung', 'Araştırma', '研究', '研究', 'Исследования'],
  ['Moving', 'Mobilité', 'Mudanza', 'Trasferimento', 'Umzug', 'Taşınma', '搬迁', '移住', 'Переезд'],
  ['Academic life', 'Vie académique', 'Vida académica', 'Vita accademica', 'Akademisches Leben', 'Akademik yaşam', '学术生活', '研究生活', 'Академическая жизнь'],
  ['For you', 'Pour vous', 'Para ti', 'Per te', 'Für dich', 'Senin için', '为你推荐', 'おすすめ', 'Для вас'],
  ['Ask the research community…', 'Demandez à la communauté scientifique…', 'Pregunta a la comunidad investigadora…', 'Chiedi alla comunità di ricerca…', 'Frage die Forschungscommunity…', 'Araştırma topluluğuna sor…', '向研究社区提问…', '研究コミュニティに質問…', 'Спросите исследовательское сообщество…'],
  ['Complete your profile before posting', 'Complétez votre profil avant de publier', 'Completa tu perfil antes de publicar', 'Completa il profilo prima di pubblicare', 'Vervollständige dein Profil vor dem Posten', 'Paylaşmadan önce profilini tamamla', '发布前请完善个人资料', '投稿前にプロフィールを完成してください', 'Заполните профиль перед публикацией'],
  ['No posts here yet', 'Aucune publication pour le moment', 'Aún no hay publicaciones', 'Non ci sono ancora post', 'Noch keine Beiträge', 'Henüz paylaşım yok', '暂无帖子', 'まだ投稿はありません', 'Публикаций пока нет'],
  ['Create a community post', 'Créer une publication', 'Crear una publicación', 'Crea un post', 'Community-Beitrag erstellen', 'Topluluk gönderisi oluştur', '创建社区帖子', 'コミュニティ投稿を作成', 'Создать публикацию'],
  ['Your post', 'Votre publication', 'Tu publicación', 'Il tuo post', 'Dein Beitrag', 'Gönderin', '你的帖子', '投稿内容', 'Ваша публикация'],
  ['Publish post', 'Publier', 'Publicar', 'Pubblica', 'Veröffentlichen', 'Gönderiyi yayınla', '发布帖子', '投稿する', 'Опубликовать'],
  ['Publishing…', 'Publication…', 'Publicando…', 'Pubblicazione…', 'Wird veröffentlicht…', 'Yayınlanıyor…', '正在发布…', '投稿中…', 'Публикация…'],
  ['Discussion', 'Discussion', 'Discusión', 'Discussione', 'Diskussion', 'Tartışma', '讨论', 'ディスカッション', 'Обсуждение'],
  ['No replies yet', 'Aucune réponse', 'Aún no hay respuestas', 'Ancora nessuna risposta', 'Noch keine Antworten', 'Henüz yanıt yok', '暂无回复', 'まだ返信はありません', 'Ответов пока нет'],
  ['Start a thoughtful academic discussion.', 'Lancez une discussion académique constructive.', 'Inicia una conversación académica constructiva.', 'Avvia una discussione accademica costruttiva.', 'Starte eine konstruktive akademische Diskussion.', 'Yapıcı bir akademik tartışma başlat.', '发起有价值的学术讨论。', '有意義な学術的議論を始めましょう。', 'Начните содержательную академическую дискуссию.'],
  ['Join the discussion', 'Participer à la discussion', 'Únete a la conversación', 'Partecipa alla discussione', 'An der Diskussion teilnehmen', 'Tartışmaya katıl', '加入讨论', '議論に参加', 'Присоединиться к обсуждению'],
  ['Write a reply', 'Écrire une réponse', 'Escribe una respuesta', 'Scrivi una risposta', 'Antwort schreiben', 'Yanıt yaz', '撰写回复', '返信を書く', 'Написать ответ'],
  ['Share a constructive thought…', 'Partagez une idée constructive…', 'Comparte una idea constructiva…', 'Condividi un pensiero costruttivo…', 'Teile einen konstruktiven Gedanken…', 'Yapıcı bir düşünce paylaş…', '分享有建设性的想法…', '建設的な意見を共有…', 'Поделитесь конструктивной мыслью…'],
  ['REPLYING TO', 'RÉPONSE À', 'RESPONDIENDO A', 'RISPOSTA A', 'ANTWORT AN', 'YANITLANAN', '回复', '返信先', 'ОТВЕТ ДЛЯ'],
  ['Show replies', 'Afficher les réponses', 'Mostrar respuestas', 'Mostra risposte', 'Antworten anzeigen', 'Yanıtları göster', '显示回复', '返信を表示', 'Показать ответы'],
  ['Hide replies', 'Masquer les réponses', 'Ocultar respuestas', 'Nascondi risposte', 'Antworten ausblenden', 'Yanıtları gizle', '隐藏回复', '返信を非表示', 'Скрыть ответы'],
  ['reply', 'réponse', 'respuesta', 'risposta', 'Antwort', 'yanıt', '条回复', '件の返信', 'ответ'],
  ['replies', 'réponses', 'respuestas', 'risposte', 'Antworten', 'yanıt', '条回复', '件の返信', 'ответов'],
  ['Delete this reply?', 'Supprimer cette réponse ?', '¿Eliminar esta respuesta?', 'Eliminare questa risposta?', 'Diese Antwort löschen?', 'Bu yanıt silinsin mi?', '删除此回复？', 'この返信を削除しますか？', 'Удалить этот ответ?'],
  ['Delete reply', 'Supprimer la réponse', 'Eliminar respuesta', 'Elimina risposta', 'Antwort löschen', 'Yanıtı sil', '删除回复', '返信を削除', 'Удалить ответ'],
  ['This cannot be undone.', 'Cette action est irréversible.', 'Esta acción no se puede deshacer.', 'Questa azione non può essere annullata.', 'Dies kann nicht rückgängig gemacht werden.', 'Bu işlem geri alınamaz.', '此操作无法撤销。', 'この操作は取り消せません。', 'Это действие нельзя отменить.'],
  ['Account controls', 'Contrôles du compte', 'Controles de la cuenta', 'Controlli account', 'Kontoeinstellungen', 'Hesap denetimleri', '账户控制', 'アカウント管理', 'Управление аккаунтом'],
  ['Privacy, notifications and your data.', 'Confidentialité, notifications et vos données.', 'Privacidad, notificaciones y tus datos.', 'Privacy, notifiche e i tuoi dati.', 'Datenschutz, Benachrichtigungen und deine Daten.', 'Gizlilik, bildirimler ve verilerin.', '隐私、通知和你的数据。', 'プライバシー、通知、データ。', 'Конфиденциальность, уведомления и данные.'],
  ['APP LANGUAGE', 'LANGUE DE L’APPLICATION', 'IDIOMA DE LA APLICACIÓN', 'LINGUA DELL’APP', 'APP-SPRACHE', 'UYGULAMA DİLİ', '应用语言', 'アプリの言語', 'ЯЗЫК ПРИЛОЖЕНИЯ'],
  ['Language', 'Langue', 'Idioma', 'Lingua', 'Sprache', 'Dil', '语言', '言語', 'Язык'],
  ['Choose the language used throughout Scholara.', 'Choisissez la langue utilisée dans Scholara.', 'Elige el idioma utilizado en Scholara.', 'Scegli la lingua usata in Scholara.', 'Wähle die Sprache für Scholara.', 'Scholara genelinde kullanılacak dili seç.', '选择 Scholara 的显示语言。', 'Scholaraで使用する言語を選択します。', 'Выберите язык интерфейса Scholara.'],
  ['PRIVACY', 'CONFIDENTIALITÉ', 'PRIVACIDAD', 'PRIVACY', 'DATENSCHUTZ', 'GİZLİLİK', '隐私', 'プライバシー', 'КОНФИДЕНЦИАЛЬНОСТЬ'],
  ['NOTIFICATIONS', 'NOTIFICATIONS', 'NOTIFICACIONES', 'NOTIFICHE', 'BENACHRICHTIGUNGEN', 'BİLDİRİMLER', '通知', '通知', 'УВЕДОМЛЕНИЯ'],
  ['Phone notifications', 'Notifications du téléphone', 'Notificaciones del teléfono', 'Notifiche del telefono', 'Telefonbenachrichtigungen', 'Telefon bildirimleri', '手机通知', 'スマートフォン通知', 'Уведомления телефона'],
  ['Community', 'Communauté', 'Comunidad', 'Comunità', 'Community', 'Topluluk', '社区', 'コミュニティ', 'Сообщество'],
  ['Product updates', 'Actualités du produit', 'Novedades del producto', 'Aggiornamenti prodotto', 'Produktneuigkeiten', 'Ürün güncellemeleri', '产品更新', '製品アップデート', 'Обновления продукта'],
  ['Save notification choices', 'Enregistrer les notifications', 'Guardar notificaciones', 'Salva notifiche', 'Benachrichtigungen speichern', 'Bildirim seçimlerini kaydet', '保存通知设置', '通知設定を保存', 'Сохранить уведомления'],
  ['Save privacy choices', 'Enregistrer la confidentialité', 'Guardar privacidad', 'Salva privacy', 'Datenschutz speichern', 'Gizlilik seçimlerini kaydet', '保存隐私设置', 'プライバシー設定を保存', 'Сохранить настройки приватности'],
  ['LEGAL & COMMUNITY', 'JURIDIQUE ET COMMUNAUTÉ', 'LEGAL Y COMUNIDAD', 'LEGALE E COMUNITÀ', 'RECHTLICHES & COMMUNITY', 'YASAL & TOPLULUK', '法律与社区', '法務・コミュニティ', 'ПРАВИЛА И СООБЩЕСТВО'],
  ['YOUR DATA', 'VOS DONNÉES', 'TUS DATOS', 'I TUOI DATI', 'DEINE DATEN', 'VERİLERİN', '你的数据', 'あなたのデータ', 'ВАШИ ДАННЫЕ'],
  ['DELETE ACCOUNT', 'SUPPRIMER LE COMPTE', 'ELIMINAR CUENTA', 'ELIMINA ACCOUNT', 'KONTO LÖSCHEN', 'HESABI SİL', '删除账户', 'アカウント削除', 'УДАЛИТЬ АККАУНТ'],
  ['Delete my account', 'Supprimer mon compte', 'Eliminar mi cuenta', 'Elimina il mio account', 'Mein Konto löschen', 'Hesabımı sil', '删除我的账户', 'アカウントを削除', 'Удалить мой аккаунт'],
  ['Matches', 'Connexions', 'Conexiones', 'Abbinamenti', 'Kontakte', 'Eşleşmeler', '匹配', 'マッチ', 'Совпадения'],
  ['New messages from matched researchers.', 'Nouveaux messages de chercheurs connectés.', 'Nuevos mensajes de investigadores conectados.', 'Nuovi messaggi dai ricercatori abbinati.', 'Neue Nachrichten von verbundenen Forschenden.', 'Eşleştiğin araştırmacılardan yeni mesajlar.', '来自已匹配研究人员的新消息。', 'マッチした研究者からの新着メッセージ。', 'Новые сообщения от совпавших исследователей.'],
  ['Edit profile', 'Modifier le profil', 'Editar perfil', 'Modifica profilo', 'Profil bearbeiten', 'Profili düzenle', '编辑个人资料', 'プロフィール編集', 'Редактировать профиль'],
  ['Notifications', 'Notifications', 'Notificaciones', 'Notifiche', 'Benachrichtigungen', 'Bildirimler', '通知', '通知', 'Уведомления'],
  ['No notifications yet', 'Aucune notification', 'Aún no hay notificaciones', 'Ancora nessuna notifica', 'Noch keine Benachrichtigungen', 'Henüz bildirim yok', '暂无通知', '通知はまだありません', 'Уведомлений пока нет'],
  ['Find people who share your research, understand where you are going, and can help you feel at home there.', 'Trouvez des personnes qui partagent vos recherches, comprennent votre parcours et peuvent vous aider à vous sentir chez vous.', 'Encuentra personas que compartan tu investigación, comprendan tu rumbo y te ayuden a sentirte en casa.', 'Trova persone che condividono la tua ricerca, comprendono il tuo percorso e possono aiutarti a sentirti a casa.', 'Finde Menschen, die deine Forschung teilen, deinen Weg verstehen und dir helfen, dich zuhause zu fühlen.', 'Araştırmanı paylaşan, nereye gittiğini anlayan ve kendini oraya ait hissetmene yardımcı olabilecek insanları bul.', '找到与你研究方向相近、理解你的去向并帮助你融入当地的人。', '研究を共有し、進む先を理解し、そこで安心して過ごせるよう支えてくれる人を見つけましょう。', 'Находите людей с близкими научными интересами, которые понимают ваш путь и помогут освоиться.'],
  ['Welcome back', 'Bon retour', 'Te damos la bienvenida', 'Bentornato', 'Willkommen zurück', 'Tekrar hoş geldin', '欢迎回来', 'おかえりなさい', 'С возвращением'],
  ['Continue your academic network.', 'Poursuivez votre réseau académique.', 'Continúa con tu red académica.', 'Continua a coltivare la tua rete accademica.', 'Setze dein akademisches Netzwerk fort.', 'Akademik ağına devam et.', '继续拓展你的学术网络。', '学術ネットワークを広げましょう。', 'Продолжайте развивать академическую сеть.'],
  ['Sign in securely with your Scholara account.', 'Connectez-vous en toute sécurité avec votre compte Scholara.', 'Inicia sesión de forma segura con tu cuenta de Scholara.', 'Accedi in modo sicuro con il tuo account Scholara.', 'Melde dich sicher mit deinem Scholara-Konto an.', 'Scholara hesabınla güvenli şekilde giriş yap.', '使用 Scholara 账户安全登录。', 'Scholaraアカウントで安全にログインします。', 'Безопасно войдите с аккаунтом Scholara.'],
  ['Forgot password?', 'Mot de passe oublié ?', '¿Olvidaste tu contraseña?', 'Password dimenticata?', 'Passwort vergessen?', 'Şifreni mi unuttun?', '忘记密码？', 'パスワードを忘れましたか？', 'Забыли пароль?'],
  ['Create a new account', 'Créer un nouveau compte', 'Crear una cuenta nueva', 'Crea un nuovo account', 'Neues Konto erstellen', 'Yeni hesap oluştur', '创建新账户', '新しいアカウントを作成', 'Создать новый аккаунт'],
  ['Start with your academic identity.', 'Commencez par votre identité académique.', 'Empieza con tu identidad académica.', 'Inizia dalla tua identità accademica.', 'Beginne mit deiner akademischen Identität.', 'Akademik kimliğinle başla.', '从你的学术身份开始。', '研究者としてのプロフィールから始めましょう。', 'Начните с академического профиля.'],
  ['Full name', 'Nom complet', 'Nombre completo', 'Nome completo', 'Vollständiger Name', 'Ad soyad', '姓名', '氏名', 'Полное имя'],
  ['Your full name', 'Votre nom complet', 'Tu nombre completo', 'Il tuo nome completo', 'Dein vollständiger Name', 'Adın ve soyadın', '你的姓名', '氏名', 'Ваше полное имя'],
  ['Your password', 'Votre mot de passe', 'Tu contraseña', 'La tua password', 'Dein Passwort', 'Şifren', '你的密码', 'パスワード', 'Ваш пароль'],
  ['At least 12 characters', 'Au moins 12 caractères', 'Al menos 12 caracteres', 'Almeno 12 caratteri', 'Mindestens 12 Zeichen', 'En az 12 karakter', '至少 12 个字符', '12文字以上', 'Не менее 12 символов'],
  ['I already have an account', 'J’ai déjà un compte', 'Ya tengo una cuenta', 'Ho già un account', 'Ich habe bereits ein Konto', 'Zaten hesabım var', '我已有账户', 'すでにアカウントがあります', 'У меня уже есть аккаунт'],
  ['Connections', 'Connexions', 'Conexiones', 'Connessioni', 'Kontakte', 'Bağlantılar', '联系', 'つながり', 'Связи'],
  ['Your academic connections.', 'Vos connexions académiques.', 'Tus conexiones académicas.', 'Le tue connessioni accademiche.', 'Deine akademischen Kontakte.', 'Akademik bağlantıların.', '你的学术联系。', '学術的なつながり。', 'Ваши академические связи.'],
  ['Requests become matches when both researchers choose to connect.', 'Les demandes deviennent des connexions lorsque les deux chercheurs acceptent.', 'Las solicitudes se convierten en conexiones cuando ambos investigadores aceptan.', 'Le richieste diventano connessioni quando entrambi i ricercatori accettano.', 'Anfragen werden zu Kontakten, wenn beide Forschenden zustimmen.', 'İki araştırmacı da bağlantı kurmayı seçtiğinde istekler eşleşmeye dönüşür.', '双方研究人员都选择连接后，请求会成为匹配。', '双方の研究者がつながると、リクエストがマッチになります。', 'Запрос становится совпадением, когда оба исследователя выбирают связь.'],
  ['No connection requests yet', 'Aucune demande de connexion', 'Aún no hay solicitudes de conexión', 'Nessuna richiesta di connessione', 'Noch keine Kontaktanfragen', 'Henüz bağlantı isteği yok', '暂无连接请求', '接続リクエストはまだありません', 'Запросов на связь пока нет'],
  ['View full profile', 'Voir le profil complet', 'Ver perfil completo', 'Vedi profilo completo', 'Vollständiges Profil ansehen', 'Tam profili görüntüle', '查看完整资料', 'プロフィールをすべて見る', 'Открыть полный профиль'],
  ['Connect', 'Se connecter', 'Conectar', 'Connetti', 'Verbinden', 'Bağlan', '连接', 'つながる', 'Связаться'],
  ['Connect back', 'Accepter la connexion', 'Conectar también', 'Ricambia la connessione', 'Zurückverbinden', 'Bağlantıyı kabul et', '接受连接', 'つながり返す', 'Принять связь'],
  ['Request sent', 'Demande envoyée', 'Solicitud enviada', 'Richiesta inviata', 'Anfrage gesendet', 'İstek gönderildi', '请求已发送', 'リクエスト送信済み', 'Запрос отправлен'],
  ['Continue the conversation.', 'Poursuivez la conversation.', 'Continúa la conversación.', 'Continua la conversazione.', 'Setze das Gespräch fort.', 'Sohbete devam et.', '继续对话。', '会話を続けましょう。', 'Продолжите разговор.'],
  ['Private messaging is available only after a mutual match.', 'La messagerie privée est disponible uniquement après une connexion mutuelle.', 'Los mensajes privados solo están disponibles tras una conexión mutua.', 'I messaggi privati sono disponibili solo dopo una connessione reciproca.', 'Private Nachrichten sind erst nach einer gegenseitigen Verbindung verfügbar.', 'Özel mesajlaşma yalnızca karşılıklı eşleşmeden sonra kullanılabilir.', '只有双方匹配后才能发送私信。', 'プライベートメッセージは相互マッチ後に利用できます。', 'Личные сообщения доступны только после взаимного совпадения.'],
  ['No conversations yet', 'Aucune conversation', 'Aún no hay conversaciones', 'Nessuna conversazione', 'Noch keine Unterhaltungen', 'Henüz konuşma yok', '暂无对话', '会話はまだありません', 'Разговоров пока нет'],
  ['Only you and your matched researcher can read this conversation.', 'Seuls vous et le chercheur connecté pouvez lire cette conversation.', 'Solo tú y el investigador conectado podéis leer esta conversación.', 'Solo tu e il ricercatore collegato potete leggere questa conversazione.', 'Nur du und dein Forschungskontakt könnt diese Unterhaltung lesen.', 'Bu konuşmayı yalnızca sen ve eşleştiğin araştırmacı okuyabilirsiniz.', '只有你和已匹配的研究人员可以阅读此对话。', 'この会話を読めるのは、あなたとマッチした研究者だけです。', 'Этот разговор доступен только вам и исследователю, с которым вы совпали.'],
  ['Questions travel farther together.', 'Ensemble, les questions vont plus loin.', 'Juntas, las preguntas llegan más lejos.', 'Insieme, le domande vanno più lontano.', 'Gemeinsam kommen Fragen weiter.', 'Sorular birlikte daha uzağa ulaşır.', '问题因交流而传播得更远。', '問いは共に、さらに遠くへ。', 'Вместе вопросы находят больше ответов.'],
  ['Learn from people who are living the same academic moments.', 'Apprenez auprès de personnes qui vivent les mêmes étapes académiques.', 'Aprende de personas que viven los mismos momentos académicos.', 'Impara da persone che vivono gli stessi momenti accademici.', 'Lerne von Menschen in derselben akademischen Phase.', 'Aynı akademik dönemlerden geçen insanlardan öğren.', '向处于相同学术阶段的人学习。', '同じ研究生活を送る人々から学びましょう。', 'Учитесь у людей, проходящих тот же академический этап.'],
  ['Start the first academic conversation in this topic.', 'Lancez la première conversation académique sur ce thème.', 'Inicia la primera conversación académica sobre este tema.', 'Avvia la prima conversazione accademica su questo tema.', 'Starte das erste akademische Gespräch zu diesem Thema.', 'Bu konuda ilk akademik konuşmayı başlat.', '发起该主题的第一次学术讨论。', 'このテーマで最初の学術的な会話を始めましょう。', 'Начните первое академическое обсуждение этой темы.'],
  ['Finding relevant researchers…', 'Recherche de chercheurs pertinents…', 'Buscando investigadores relevantes…', 'Ricerca di ricercatori pertinenti…', 'Passende Forschende werden gesucht…', 'İlgili araştırmacılar bulunuyor…', '正在寻找相关研究人员…', '関連する研究者を探しています…', 'Ищем подходящих исследователей…'],
  ['Comparing academic interests and relocation context.', 'Comparaison des intérêts académiques et des projets de mobilité.', 'Comparando intereses académicos y contexto de traslado.', 'Confronto tra interessi accademici e contesto di trasferimento.', 'Akademische Interessen und Umzugskontext werden verglichen.', 'Akademik ilgi alanları ve taşınma bağlamı karşılaştırılıyor.', '正在比较学术兴趣和搬迁背景。', '研究関心と移住状況を比較しています。', 'Сравниваем научные интересы и контекст переезда.'],
  ['RESEARCH', 'RECHERCHE', 'INVESTIGACIÓN', 'RICERCA', 'FORSCHUNG', 'ARAŞTIRMA', '研究', '研究', 'ИССЛЕДОВАНИЯ'],
  ['LANGUAGES', 'LANGUES', 'IDIOMAS', 'LINGUE', 'SPRACHEN', 'DİLLER', '语言', '言語', 'ЯЗЫКИ'],
  ['ACADEMIC LOCATION', 'LOCALISATION ACADÉMIQUE', 'UBICACIÓN ACADÉMICA', 'SEDE ACCADEMICA', 'AKADEMISCHER ORT', 'AKADEMİK KONUM', '学术地点', '研究拠点', 'АКАДЕМИЧЕСКОЕ МЕСТОПОЛОЖЕНИЕ'],
  ['TRUST & SAFETY', 'CONFIANCE ET SÉCURITÉ', 'CONFIANZA Y SEGURIDAD', 'FIDUCIA E SICUREZZA', 'VERTRAUEN & SICHERHEIT', 'GÜVEN & GÜVENLİK', '信任与安全', '信頼と安全', 'ДОВЕРИЕ И БЕЗОПАСНОСТЬ'],
  ['No interests yet', 'Aucun intérêt ajouté', 'Aún no hay intereses', 'Nessun interesse aggiunto', 'Noch keine Interessen', 'Henüz ilgi alanı yok', '尚未添加兴趣', '関心分野はまだありません', 'Интересы пока не добавлены'],
  ['No languages added', 'Aucune langue ajoutée', 'No se han añadido idiomas', 'Nessuna lingua aggiunta', 'Keine Sprachen hinzugefügt', 'Henüz dil eklenmedi', '尚未添加语言', '言語はまだ追加されていません', 'Языки пока не добавлены'],
  ['Account & privacy settings', 'Paramètres du compte et de confidentialité', 'Ajustes de cuenta y privacidad', 'Impostazioni account e privacy', 'Konto- und Datenschutzeinstellungen', 'Hesap ve gizlilik ayarları', '账户与隐私设置', 'アカウントとプライバシー設定', 'Настройки аккаунта и приватности'],
  ['Institution or research organization', 'Établissement ou organisme de recherche', 'Institución u organización de investigación', 'Istituzione o ente di ricerca', 'Institution oder Forschungseinrichtung', 'Üniversite veya araştırma kuruluşu', '院校或研究机构', '大学・研究機関', 'Учебное или исследовательское учреждение'],
  ['Current country', 'Pays actuel', 'País actual', 'Paese attuale', 'Aktuelles Land', 'Mevcut ülke', '当前国家', '現在の国', 'Текущая страна'],
  ['Current city', 'Ville actuelle', 'Ciudad actual', 'Città attuale', 'Aktuelle Stadt', 'Mevcut şehir', '当前城市', '現在の都市', 'Текущий город'],
  ['Profile setup', 'Configuration du profil', 'Configuración del perfil', 'Configurazione profilo', 'Profil einrichten', 'Profil kurulumu', '设置个人资料', 'プロフィール設定', 'Настройка профиля'],
  ['Academic identity', 'Identité académique', 'Identidad académica', 'Identità accademica', 'Akademische Identität', 'Akademik kimlik', '学术身份', '研究者情報', 'Академическая идентичность'],
  ['How should researchers find you?', 'Comment les chercheurs doivent-ils vous trouver ?', '¿Cómo deberían encontrarte otros investigadores?', 'Come dovrebbero trovarti i ricercatori?', 'Wie sollen Forschende dich finden?', 'Araştırmacılar seni nasıl bulmalı?', '研究人员应如何找到你？', '研究者にどのように見つけてもらいますか？', 'Как исследователям находить вас?'],
  ['Your research', 'Votre recherche', 'Tu investigación', 'La tua ricerca', 'Deine Forschung', 'Araştırman', '你的研究', 'あなたの研究', 'Ваше исследование'],
  ['What do you research?', 'Sur quoi portent vos recherches ?', '¿Qué investigas?', 'Di cosa ti occupi?', 'Woran forschst du?', 'Ne üzerine araştırma yapıyorsun?', '你的研究方向是什么？', '何を研究していますか？', 'Что вы исследуете?'],
  ['Your goals', 'Vos objectifs', 'Tus objetivos', 'I tuoi obiettivi', 'Deine Ziele', 'Hedeflerin', '你的目标', 'あなたの目標', 'Ваши цели'],
  ['What are you here for?', 'Que recherchez-vous ici ?', '¿Qué buscas aquí?', 'Cosa cerchi qui?', 'Was suchst du hier?', 'Burada ne arıyorsun?', '你来这里是为了什么？', 'ここで何を求めていますか？', 'Зачем вы здесь?'],
  ['Location', 'Localisation', 'Ubicación', 'Posizione', 'Standort', 'Konum', '位置', '場所', 'Местоположение'],
  ['Where are you now—and where are you going?', 'Où êtes-vous maintenant — et où allez-vous ?', '¿Dónde estás ahora y adónde vas?', 'Dove sei ora e dove stai andando?', 'Wo bist du jetzt – und wohin gehst du?', 'Şu an neredesin ve nereye gidiyorsun?', '你现在在哪里，又将前往哪里？', '今どこにいて、どこへ向かいますか？', 'Где вы сейчас и куда направляетесь?'],
  ['One step left', 'Une dernière étape', 'Queda un paso', 'Manca un ultimo passaggio', 'Noch ein Schritt', 'Son bir adım', '还差一步', 'あと一歩です', 'Остался один шаг'],
  ['Verify that this email address belongs to you.', 'Confirmez que cette adresse e-mail vous appartient.', 'Verifica que esta dirección de correo te pertenece.', 'Verifica che questo indirizzo e-mail sia tuo.', 'Bestätige, dass diese E-Mail-Adresse dir gehört.', 'Bu e-posta adresinin sana ait olduğunu doğrula.', '请验证此邮箱地址属于你。', 'このメールアドレスが本人のものか確認してください。', 'Подтвердите, что этот адрес электронной почты принадлежит вам.'],
  ['Open the link we sent to {{email}}, then return to Scholara.', 'Ouvrez le lien envoyé à {{email}}, puis revenez dans Scholara.', 'Abre el enlace que enviamos a {{email}} y vuelve a Scholara.', 'Apri il link inviato a {{email}}, poi torna su Scholara.', 'Öffne den Link, den wir an {{email}} gesendet haben, und kehre zu Scholara zurück.', '{{email}} adresine gönderdiğimiz bağlantıyı aç, ardından Scholara’ya dön.', '打开我们发送至 {{email}} 的链接，然后返回 Scholara。', '{{email}} に送信したリンクを開き、Scholaraに戻ってください。', 'Откройте ссылку, отправленную на {{email}}, затем вернитесь в Scholara.'],
  ['your email address', 'votre adresse e-mail', 'tu correo electrónico', 'il tuo indirizzo e-mail', 'deine E-Mail-Adresse', 'e-posta adresin', '你的邮箱', 'メールアドレス', 'вашу электронную почту'],
  ['Did you see a localhost error on your computer?', 'Avez-vous vu une erreur localhost sur votre ordinateur ?', '¿Viste un error de localhost en tu ordenador?', 'Hai visto un errore localhost sul computer?', 'Hast du auf deinem Computer einen localhost-Fehler gesehen?', 'Bilgisayarında localhost hatası mı gördün?', '你在电脑上看到 localhost 错误了吗？', 'パソコンでlocalhostエラーが表示されましたか？', 'На компьютере появилась ошибка localhost?'],
  ['Verification probably completed. Return here and use the continue button below.', 'La vérification est probablement terminée. Revenez ici et utilisez le bouton ci-dessous.', 'Probablemente la verificación se completó. Vuelve aquí y usa el botón de abajo.', 'La verifica è probabilmente completata. Torna qui e usa il pulsante qui sotto.', 'Die Bestätigung wurde wahrscheinlich abgeschlossen. Kehre hierher zurück und nutze die Schaltfläche unten.', 'Doğrulama büyük olasılıkla tamamlandı. Buraya dönüp aşağıdaki devam düğmesini kullan.', '验证可能已经完成。请返回此页面并点击下方的继续按钮。', '確認は完了している可能性があります。ここに戻り、下の続行ボタンを押してください。', 'Проверка, вероятно, завершена. Вернитесь сюда и нажмите кнопку продолжения.'],
  ['Open email app', 'Ouvrir l’application e-mail', 'Abrir la aplicación de correo', 'Apri l’app e-mail', 'E-Mail-App öffnen', 'E-posta uygulamasını aç', '打开邮箱应用', 'メールアプリを開く', 'Открыть почтовое приложение'],
  ['I verified my email, continue', 'J’ai vérifié mon e-mail, continuer', 'He verificado mi correo, continuar', 'Ho verificato l’e-mail, continua', 'E-Mail bestätigt, weiter', 'E-postamı doğruladım, devam et', '我已验证邮箱，继续', 'メールを確認しました。続ける', 'Я подтвердил почту, продолжить'],
  ['Resend email', 'Renvoyer l’e-mail', 'Reenviar correo', 'Invia di nuovo l’e-mail', 'E-Mail erneut senden', 'E-postayı yeniden gönder', '重新发送邮件', 'メールを再送信', 'Отправить письмо повторно'],
  ['Sending…', 'Envoi…', 'Enviando…', 'Invio…', 'Wird gesendet…', 'Gönderiliyor…', '正在发送…', '送信中…', 'Отправка…'],
  ['Resend in {{seconds}}s', 'Renvoyer dans {{seconds}} s', 'Reenviar en {{seconds}} s', 'Invia di nuovo tra {{seconds}} s', 'In {{seconds}} s erneut senden', '{{seconds}} sn sonra yeniden gönder', '{{seconds}} 秒后重发', '{{seconds}}秒後に再送信', 'Повторить через {{seconds}} с'],
  ['A new verification email was sent.', 'Un nouvel e-mail de vérification a été envoyé.', 'Se envió un nuevo correo de verificación.', 'È stata inviata una nuova e-mail di verifica.', 'Eine neue Bestätigungs-E-Mail wurde gesendet.', 'Yeni doğrulama e-postası gönderildi.', '新的验证邮件已发送。', '新しい確認メールを送信しました。', 'Новое письмо для подтверждения отправлено.'],
  ['Email verified', 'E-mail vérifié', 'Correo verificado', 'E-mail verificata', 'E-Mail bestätigt', 'E-posta doğrulandı', '邮箱已验证', 'メール確認済み', 'Почта подтверждена'],
  ['Preparing your Scholara account…', 'Préparation de votre compte Scholara…', 'Preparando tu cuenta de Scholara…', 'Preparazione del tuo account Scholara…', 'Dein Scholara-Konto wird vorbereitet…', 'Scholara hesabın hazırlanıyor…', '正在准备你的 Scholara 账户…', 'Scholaraアカウントを準備しています…', 'Подготавливаем ваш аккаунт Scholara…'],
  ['Verification finished', 'Vérification terminée', 'Verificación finalizada', 'Verifica completata', 'Bestätigung abgeschlossen', 'Doğrulama tamamlandı', '验证完成', '確認が完了しました', 'Проверка завершена'],
  ['Return to Scholara.', 'Revenez dans Scholara.', 'Vuelve a Scholara.', 'Torna su Scholara.', 'Zurück zu Scholara.', 'Scholara’ya geri dön.', '返回 Scholara。', 'Scholaraに戻ります。', 'Вернитесь в Scholara.'],
  ['Go to sign in', 'Aller à la connexion', 'Ir a iniciar sesión', 'Vai all’accesso', 'Zur Anmeldung', 'Giriş ekranına git', '前往登录', 'ログインへ', 'Перейти ко входу'],
  ['comment', 'commentaire', 'comentario', 'commento', 'Kommentar', 'yorum', '条评论', '件のコメント', 'комментарий'],
  ['comments', 'commentaires', 'comentarios', 'commenti', 'Kommentare', 'yorum', '条评论', '件のコメント', 'комментариев'],
  ['helpful', 'utile', 'útil', 'utile', 'hilfreich', 'faydalı', '有帮助', '参考になった', 'полезно'],
  ['Show password', 'Afficher le mot de passe', 'Mostrar contraseña', 'Mostra password', 'Passwort anzeigen', 'Şifreyi göster', '显示密码', 'パスワードを表示', 'Показать пароль'],
  ['Hide password', 'Masquer le mot de passe', 'Ocultar contraseña', 'Nascondi password', 'Passwort ausblenden', 'Şifreyi gizle', '隐藏密码', 'パスワードを隠す', 'Скрыть пароль'],
];

const languageOrder: AppLanguage[] = ['en', 'fr', 'es', 'it', 'de', 'tr', 'zh', 'ja', 'ru'];
const dictionaries = Object.fromEntries(languageOrder.map((language, index) => [language, new Map(rows.map((row) => [row[0], row[index]]))])) as Record<AppLanguage, Map<string, string>>;
const storageKey = 'scholara.app-language';

const isLanguage = (value: string | null): value is AppLanguage => Boolean(value && languageOrder.includes(value as AppLanguage));
const deviceLanguage = (): AppLanguage => {
  const code = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0].toLowerCase();
  return isLanguage(code) ? code : 'en';
};

type I18nState = {
  language: AppLanguage;
  locale: string;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (source: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>(deviceLanguage);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then((stored) => {
      if (active && isLanguage(stored)) setLanguageState(stored);
    });
    return () => { active = false; };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    setLanguageState(next);
    await AsyncStorage.setItem(storageKey, next);
  }, []);

  const t = useCallback((source: string, values?: Record<string, string | number>) => {
    let translated = dictionaries[language].get(source) ?? source;
    Object.entries(values ?? {}).forEach(([key, value]) => { translated = translated.replaceAll(`{{${key}}}`, String(value)); });
    return translated;
  }, [language]);

  const locale = appLanguages.find((item) => item.code === language)?.locale ?? 'en-US';
  const value = useMemo(() => ({ language, locale, setLanguage, t }), [language, locale, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
