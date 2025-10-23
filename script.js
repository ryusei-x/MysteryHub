/ index.html で window に設定された Firestore の関数とインスタンスを使用します。

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
        alert("コメントを入力してください！");
        return;
    }

    try {
        // Firestore の 'posts' コレクションへの参照を取得 (V9 collection 関数を使用)
        const postsCollectionRef = collection(db, "posts");
        
        // データを追加 (いいね初期値0を追加)
        await addDoc(postsCollectionRef, {
            author: author,
            content: content,
            timestamp: serverTimestamp(), // 投稿日時を自動で記録
            likes: 0 // ★追加: いいねの初期値★
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
const doc = window.doc;
const updateDoc = window.updateDoc;
const increment = window.increment;


// ★新規関数: 各投稿に対する返信リスナーを設定する関数★
function setupReplyListener(postId) {
    const repliesQuery = query(
        collection(db, "posts", postId, "replies"), // サブコレクションの参照
        orderBy("timestamp", "asc") // 古い順に並べ替え
    );
    
    onSnapshot(repliesQuery, (replySnapshot) => {
        const repliesListDiv = document.getElementById(`replies-list-${postId}`);
        if (!repliesListDiv) return;

        repliesListDiv.innerHTML = ''; // 既存の返信リストをクリア

        replySnapshot.forEach(replyDoc => {
            const reply = replyDoc.data();
            const replyElement = document.createElement('div');
            replyElement.className = 'reply-item';
            
            const dateObject = reply.timestamp ? reply.timestamp.toDate() : null;
            const dateString = dateObject ? dateObject.toLocaleString('ja-JP') : '投稿中...';

            replyElement.innerHTML = `
                <div class="reply-header">
                    <strong>${reply.author}</strong>
                    <span class="reply-date">${dateString}</span>
                </div>
                <p class="reply-content">${reply.content}</p>
            `;
            
            repliesListDiv.appendChild(replyElement);
        });
    });
}


// リアルタイムリスナーを設定 (V9 onSnapshot 関数を使用)
const postsQuery = query(
    collection(db, "posts"),
    orderBy("timestamp", "desc") // 新しい投稿順に並べ替え
);

onSnapshot(postsQuery, (snapshot) => {
    postsDiv.innerHTML = ''; 

    snapshot.forEach(docSnapshot => { 
        const post = docSnapshot.data();
        const postId = docSnapshot.id; // ドキュメントIDを取得（いいね/返信に必須）
        const postElement = document.createElement('div');
        postElement.className = 'post-card';
        
        const dateObject = post.timestamp ? post.timestamp.toDate() : null;
        const dateString = dateObject ? dateObject.toLocaleString('ja-JP') : '投稿中...';

        // 投稿内容を HTML に挿入 (いいねボタンと返信エリアの枠を追加)
        postElement.innerHTML = `
            <div class="post-header">
                <strong>${post.author}</strong>
                <span class="post-date">${dateString}</span>
            </div>
            <p class="post-content">${post.content}</p>
            
            <div class="post-footer">
                <button class="like-button" data-post-id="${postId}">
                    いいね！ (${post.likes || 0})
                </button>
                <button class="toggle-reply-button" data-post-id="${postId}">
                    返信する
                </button>
            </div>

            <div class="reply-section" id="reply-section-${postId}" style="display: none;">
                <input type="text" class="reply-author" placeholder="返信者の名前（省略可）">
                <textarea class="reply-content" placeholder="返信内容"></textarea>
                <button class="reply-post-button" data-post-id="${postId}">返信を投稿</button>
                <div class="replies-list" id="replies-list-${postId}">
                    </div>
            </div>
        `;
        
        postsDiv.appendChild(postElement);
        
        // ★イベントリスナー設定 1: いいねボタン★
        postElement.querySelector(`.like-button`).addEventListener('click', async (e) => {
            const currentPostId = e.target.getAttribute('data-post-id');
            const postRef = doc(db, 'posts', currentPostId);
            
            try {
                // likesフィールドを1増加させる
                await updateDoc(postRef, {
                    likes: increment(1)
                });
            } catch (error) {
                console.error("いいねエラー:", error);
            }
        });
        
        // ★イベントリスナー設定 2: 返信トグルボタン★
        postElement.querySelector(`.toggle-reply-button`).addEventListener('click', (e) => {
            const currentPostId = e.target.getAttribute('data-post-id');
            const replySection = document.getElementById(`reply-section-${currentPostId}`);
            // 表示/非表示を切り替える
            replySection.style.display = (replySection.style.display === 'none' ? 'block' : 'none');
        });
        
        // ★イベントリスナー設定 3: 返信投稿ボタン★
        postElement.querySelector(`.reply-post-button`).addEventListener('click', async (e) => {
            const currentPostId = e.target.getAttribute('data-post-id');
            const section = document.getElementById(`reply-section-${currentPostId}`);
            const replyAuthorInput = section.querySelector('.reply-author');
            const replyContentInput = section.querySelector('.reply-content');

            const replyAuthor = replyAuthorInput.value.trim() || '匿名ファン';
            const replyContent = replyContentInput.value.trim();

            if (!replyContent) {
                alert("返信コメントを入力してください！");
                return;
            }

            try {
                // posts/{postId}/replies サブコレクションへの参照を取得
                const repliesCollectionRef = collection(db, "posts", currentPostId, "replies");
                
                // データを追加
                await addDoc(repliesCollectionRef, {
                    author: replyAuthor,
                    content: replyContent,
                    timestamp: serverTimestamp()
                });

                // フォームをクリア
                replyAuthorInput.value = '';
                replyContentInput.value = '';

            } catch (error) {
                console.error("返信投稿エラー:", error);
                alert("返信の投稿中にエラーが発生しました。");
            }
        });
        
        // ★返信のリアルタイム表示設定★
        setupReplyListener(postId);
    });
});
