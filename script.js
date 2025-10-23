// index.html で window に設定された Firestore の関数とインスタンスを使用します。

// 1. 必要な HTML 要素の取得
const postButton = document.getElementById('postButton');
const authorInput = document.getElementById('author');
const contentInput = document.getElementById('content');
const postsDiv = document.getElementById('posts');

// 2. 投稿ボタンクリック時の処理（書き込み処理）
postButton.addEventListener('click', async () => {
    // グローバル変数から必要な関数とインスタンスを取得
    const db = window.db;
    const addDoc = window.addDoc;
    const collection = window.collection;
    const serverTimestamp = window.serverTimestamp;
    
    const author = authorInput.value.trim() || '匿名ファン';
    const content = contentInput.value.trim();

    if (!content) {
        // alert() は非推奨ですが、ここでは簡易的に使用
        alert("コメントを入力してください！");
        return;
    }

    try {
        // Firestore の 'posts' コレクションへの参照を取得 (V9 collection 関数を使用)
        const postsCollectionRef = collection(db, "posts");
        
        // データを追加 (V9 addDoc 関数を使用)
        await addDoc(postsCollectionRef, {
            author: author,
            content: content,
            timestamp: serverTimestamp() // 投稿日時を自動で記録
        });

        // フォームをクリア
        authorInput.value = '';
        contentInput.value = '';

    } catch (error) {
        console.error("投稿エラー:", error);
        alert("投稿中にエラーが発生しました。コンソールを確認してください。");
    }
});


// 3. リアルタイムでの投稿表示処理（読み込み処理）

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
        const postElement = document.createElement('div');
        postElement.className = 'post-card';
        
        // タイムスタンプを整形
        // FirestoreのTimestampオブジェクトからDateオブジェクトを取得
        const dateObject = post.timestamp ? post.timestamp.toDate() : null;
        const dateString = dateObject ? dateObject.toLocaleString('ja-JP') : '投稿中...';

        // 投稿内容を HTML に挿入
        postElement.innerHTML = `
            <div class="post-header">
                <strong>${post.author}</strong>
                <span class="post-date">${dateString}</span>
            </div>
            <p class="post-content">${post.content}</p>
        `;
        
        // ページに追加
        postsDiv.appendChild(postElement);
    });
});