// index.html で window に設定された Firestore/Storage の関数とインスタンスを使用します。

// 1. 必要な HTML 要素の取得
const postButton = document.getElementById('postButton');
const authorInput = document.getElementById('author');
const contentInput = document.getElementById('content');
// 画像アップロード機能の要素を取得
const imageFileInput = document.getElementById('imageFile'); 
const postsDiv = document.getElementById('posts');


// ★いいね数を更新する非同期関数★
async function likePost(postId) {
    const db = window.db;
    const updateDoc = window.updateDoc;
    const doc = window.doc;
    const collection = window.collection;
    const increment = window.increment;

    try {
        // 更新したいドキュメントの参照を取得
        const postRef = doc(collection(db, "posts"), postId);
        
        // 'likes'フィールドを1インクリメント
        await updateDoc(postRef, {
            likes: increment(1)
        });
    } catch (error) {
        console.error("いいね更新エラー:", error);
    }
}


// ★返信を Firestore のサブコレクションに書き込む関数★
async function postReply(postId, author, content) {
    const db = window.db;
    const addDoc = window.addDoc;
    const collection = window.collection;
    const serverTimestamp = window.serverTimestamp;

    if (!content.trim()) {
        alert("返信内容を入力してください！");
        return;
    }

    try {
        // 特定の投稿ドキュメント内の "replies" サブコレクションへの参照を取得
        const repliesCollectionRef = collection(db, "posts", postId, "replies");
        
        await addDoc(repliesCollectionRef, {
            author: author || '匿名ファン',
            content: content,
            timestamp: serverTimestamp()
        });

    } catch (error) {
        console.error("返信投稿エラー:", error);
        alert("返信中にエラーが発生しました。コンソールを確認してください。");
    }
}


// 2. 投稿ボタンクリック時の処理（書き込み処理 - 画像アップロードを含む）
postButton.addEventListener('click', async () => {
    // グローバル変数から必要な関数とインスタンスを取得
    const db = window.db;
    const addDoc = window.addDoc;
    const collection = window.collection;
    const serverTimestamp = window.serverTimestamp;
    
    // Storage関連の関数を取得
    const storage = window.storage;
    const storageRef = window.storageRef;
    const uploadBytes = window.uploadBytes;
    const getDownloadURL = window.getDownloadURL;

    const author = authorInput.value.trim() || '匿名ファン';
    const content = contentInput.value.trim();
    // 選択されたファイルを取得
    const imageFile = imageFileInput.files[0];
    let imageUrl = null; 

    if (!content && !imageFile) { 
        alert("コメントまたは画像を入力してください！");
        return;
    }

    try {
        // ★画像ファイルが選択されている場合の処理★
        if (imageFile) {
            const uniqueFileName = `${Date.now()}_${imageFile.name}`;
            const imageRef = storageRef(storage, `post_images/${uniqueFileName}`);
            
            const snapshot = await uploadBytes(imageRef, imageFile);
            
            imageUrl = await getDownloadURL(snapshot.ref);
        }

        const postsCollectionRef = collection(db, "posts");
        
        await addDoc(postsCollectionRef, {
            author: author,
            content: content,
            imageUrl: imageUrl, // 画像URLを追加
            likes: 0,           // いいねの初期値を0に設定
            timestamp: serverTimestamp() 
        });

        // フォームをクリア
        authorInput.value = '';
        contentInput.value = '';
        imageFileInput.value = '';

    } catch (error) {
        console.error("投稿エラー:", error);
        alert("投稿中にエラーが発生しました。コンソールを確認してください。");
    }
});


// 3. リアルタイムでの投稿表示処理（読み込み処理 - いいね・返信を含む）

// グローバル変数から必要な関数とインスタンスを取得
const db = window.db;
const query = window.query;
const orderBy = window.orderBy;
const collection = window.collection;
const onSnapshot = window.onSnapshot;

// リアルタイムリスナーを設定 (V9 onSnapshot 関数を使用)
const postsQuery = query(
    collection(db, "posts"),
    orderBy("timestamp", "desc") // 新しい投稿順に並べ替え
);

onSnapshot(postsQuery, (snapshot) => {
    // 既存の投稿リストをクリア
    postsDiv.innerHTML = ''; 

    // 取得した各ドキュメント（投稿）を処理
    snapshot.forEach(doc => {
        const post = doc.data();
        const postId = doc.id; 
        const currentLikes = post.likes || 0;
        
        const postElement = document.createElement('div');
        postElement.className = 'post-card';
        
        // タイムスタンプを整形
        const dateObject = post.timestamp ? post.timestamp.toDate() : null;
        const dateString = dateObject ? dateObject.toLocaleString('ja-JP') : '投稿中...';
        
        // ★画像要素のHTMLを動的に生成★
        const imageHtml = post.imageUrl 
            ? `<img src="${post.imageUrl}" alt="投稿画像" class="post-image">`
            : ''; 

        // 投稿内容を HTML に挿入
        postElement.innerHTML = `
            <div class="post-header">
                <strong>${post.author}</strong>
                <span class="post-date">${dateString}</span>
            </div>
            <p class="post-content">${post.content}</p>
            ${imageHtml}
            
            <div class="post-actions">
                <button class="like-button" data-post-id="${postId}">いいね！</button>
                <span class="like-count">❤️ ${currentLikes}</span>
            </div>

            <div class="replies-container">
                <h4>返信</h4>
                <div id="replies-list-${postId}">
                    </div>
                <form class="reply-form" id="reply-form-${postId}">
                    <input type="text" placeholder="名前 (任意)" class="reply-author-input">
                    <textarea placeholder="返信内容" required class="reply-content-input"></textarea>
                    <button type="submit">返信する</button>
                </form>
            </div>
        `;
        
        // ★いいねボタンにイベントリスナーを設定★
        const likeButton = postElement.querySelector('.like-button');
        likeButton.addEventListener('click', () => {
            likePost(postId);
        });
        
        // ★返信サブコレクションのリアルタイムリスナーを設定★
        setupRepliesListener(postId, postElement);
        
        // ページに追加
        postsDiv.appendChild(postElement);
    });
});

// ★返信サブコレクションのリスナーを設定し、表示を更新する関数★
function setupRepliesListener(postId, postElement) {
    const db = window.db;
    const query = window.query;
    const orderBy = window.orderBy;
    const collection = window.collection;
    const onSnapshot = window.onSnapshot;
    
    // 返信一覧を表示する要素
    const repliesListDiv = postElement.querySelector(`#replies-list-${postId}`);
    // 返信フォーム
    const replyForm = postElement.querySelector(`#reply-form-${postId}`);

    // 返信フォームの送信イベントを処理
    replyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const authorInput = replyForm.querySelector('.reply-author-input');
        const contentInput = replyForm.querySelector('.reply-content-input');
        
        const author = authorInput.value.trim();
        const content = contentInput.value.trim();
        
        postReply(postId, author, content)
            .then(() => {
                // 成功したらフォームをクリア
                contentInput.value = '';
            })
            .catch(error => console.error("フォームからの返信エラー:", error));
    });

    // 返信サブコレクションのクエリ
    const repliesQuery = query(
        collection(db, "posts", postId, "replies"),
        orderBy("timestamp", "asc") // 古い順に表示
    );

    // リアルタイムリスナーを設定
    onSnapshot(repliesQuery, (snapshot) => {
        repliesListDiv.innerHTML = ''; // 返信一覧をクリア
        
        snapshot.forEach(replyDoc => {
            const reply = replyDoc.data();
            const replyElement = document.createElement('div');
            replyElement.className = 'reply-item';

            const dateObject = reply.timestamp ? reply.timestamp.toDate() : null;
            const dateString = dateObject ? dateObject.toLocaleString('ja-JP') : '投稿中...';
            const replyAuthor = reply.author || '匿名ファン';

            replyElement.innerHTML = `
                <p class="reply-content">${reply.content}</p>
                <div class="reply-header">
                    <strong>${replyAuthor}</strong> 
                    <span class="reply-date">${dateString}</span>
                </div>
            `;
            repliesListDiv.appendChild(replyElement);
        });
    });
}












