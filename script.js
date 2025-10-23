// index.html で window に設定された Firestore の関数とインスタンスを使用します。

// グローバル変数から必要な関数とインスタンスを取得
const db = window.db;
const addDoc = window.addDoc;
const collection = window.collection;
const serverTimestamp = window.serverTimestamp;
const query = window.query;
const orderBy = window.orderBy;
const onSnapshot = window.onSnapshot;
const docRef = window.doc; // doc関数は docRef という変数名で取得
const updateDoc = window.updateDoc;
const increment = window.increment;
const arrayUnion = window.arrayUnion;
const arrayRemove = window.arrayRemove;
const getDoc = window.getDoc;

// 1. 必要な HTML 要素の取得
const postButton = document.getElementById('postButton');
const authorInput = document.getElementById('author');
const contentInput = document.getElementById('content');
const postsDiv = document.getElementById('posts');

// 2. 投稿ボタンクリック時の処理（書き込み処理）
postButton.addEventListener('click', async () => {
    
    // ニックネーム入力欄の値を、いいね機能でも使うためにトリムして取得
    const author = authorInput.value.trim() || '匿名ファン'; 
    const content = contentInput.value.trim();

    if (!content) {
        alert("コメントを入力してください！");
        return;
    }

    try {
        const postsCollectionRef = collection(db, "posts");
        
        // データを追加。いいね用のフィールド(likesCount)と、いいねを押したユーザーIDの配列(likedBy)を追加
        await addDoc(postsCollectionRef, {
            author: author,
            content: content,
            timestamp: serverTimestamp(),
            likesCount: 0, // ★新規追加: いいね数
            likedBy: [],   // ★新規追加: いいねしたユーザーID（ここではニックネームで代用）
        });

        // フォームをクリア
        contentInput.value = '';

    } catch (error) {
        console.error("投稿エラー:", error);
        alert("投稿中にエラーが発生しました。コンソールを確認してください。");
    }
});


// 3. いいね機能の実装 (★新規追加)
async function toggleLike(postId, currentAuthor) {
    if (!currentAuthor) {
        alert("いいねするにはニックネームを入力してください！");
        return;
    }
    
    // ユーザーはニックネーム（currentAuthor）で識別することにします。
    const postRef = docRef(db, "posts", postId);
    
    // 現在の投稿ドキュメントを取得して、いいね状態を確認
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) {
        console.error("投稿が見つかりません:", postId);
        return;
    }
    
    const postData = postSnap.data();
    // ニックネームが likedBy 配列に含まれているか確認
    const isLiked = postData.likedBy && postData.likedBy.includes(currentAuthor);
    
    try {
        if (isLiked) {
            // いいねを解除: カウントを減らし、ニックネームを配列から削除
            await updateDoc(postRef, {
                likesCount: increment(-1),
                likedBy: arrayRemove(currentAuthor)
            });
        } else {
            // いいねを追加: カウントを増やし、ニックネームを配列に追加
            await updateDoc(postRef, {
                likesCount: increment(1),
                likedBy: arrayUnion(currentAuthor)
            });
        }
    } catch (error) {
        console.error("いいね処理エラー:", error);
        alert("いいね処理中にエラーが発生しました。コンソールを確認してください。");
    }
}
window.toggleLike = toggleLike; // HTMLから呼び出せるようにグローバルに公開


// 4. 返信機能の処理 (★新規追加)
async function postReply(postId) {
    // ニックネーム入力欄から自動取得
    const replyAuthor = authorInput.value.trim();
    if (!replyAuthor) {
        alert("返信するにはニックネームを入力してください！");
        return;
    }

    const replyContent = prompt("返信コメントを入力してください:");
    if (!replyContent) return;

    try {
        // 返信は投稿ドキュメントのサブコレクション 'replies' に追加
        const repliesCollectionRef = collection(db, "posts", postId, "replies");
        await addDoc(repliesCollectionRef, {
            author: replyAuthor,
            content: replyContent,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("返信投稿エラー:", error);
        alert("返信投稿中にエラーが発生しました。コンソールを確認してください。");
    }
}
window.postReply = postReply; // HTMLから呼び出せるようにグローバルに公開


// 5. リアルタイムでの投稿表示処理（読み込み処理）とDOM生成の更新

// 投稿に返信を表示するサブ関数
function renderReplies(postDocId, repliesDiv) {
    // サブコレクション 'replies' へのクエリ
    const repliesQuery = query(
        collection(db, "posts", postDocId, "replies"),
        orderBy("timestamp", "asc") // 古い返信順に並べ替え
    );

    // 返信のリアルタイムリスナーを設定
    onSnapshot(repliesQuery, (replySnapshot) => {
        repliesDiv.innerHTML = ''; // 既存の返信リストをクリア
        
        if (replySnapshot.empty) {
            repliesDiv.innerHTML = '<small style="color:#666;">まだ返信はありません。</small>';
            return;
        }

        replySnapshot.forEach(replyDoc => {
            const reply = replyDoc.data();
            const replyElement = document.createElement('div');
            replyElement.className = 'reply-card';

            const dateObject = reply.timestamp ? reply.timestamp.toDate() : null;
            const dateString = dateObject ? dateObject.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '投稿中...';
            
            replyElement.innerHTML = `
                <small><strong>${reply.author}</strong> (${dateString}): ${reply.content}</small>
            `;
            repliesDiv.appendChild(replyElement);
        });
    });
}


// メインの投稿リスナー
const postsQuery = query(
    collection(db, "posts"),
    orderBy("timestamp", "desc") // 新しい投稿順に並べ替え
);

onSnapshot(postsQuery, (snapshot) => {
    postsDiv.innerHTML = ''; 

    snapshot.forEach(doc => {
        const post = doc.data();
        const postId = doc.id; // ドキュメントIDを取得 (いいねや返信で必要)
        const postElement = document.createElement('div');
        postElement.className = 'post-card';
        
        const dateObject = post.timestamp ? post.timestamp.toDate() : null;
        const dateString = dateObject ? dateObject.toLocaleString('ja-JP') : '投稿中...';
        
        // ニックネーム入力欄から現在のユーザー名を取得（いいねの判定に使用）
        // フォームに入力がなければ空文字列
        const currentAuthor = authorInput.value.trim(); 
        
        // currentAuthorが存在し、かつ likedBy 配列に含まれているか確認
        const isLiked = currentAuthor && post.likedBy && post.likedBy.includes(currentAuthor);
        const likeButtonClass = isLiked ? 'liked' : '';
        const likeButtonText = isLiked ? '★いいね解除' : 'いいね！';

        // currentAuthorが空の場合はボタンを無効化
        const disabledAttr = currentAuthor ? '' : 'disabled title="ニックネームを入力するといいねできます"';
        
        // onclickに渡す文字列に含まれる可能性のあるシングルクォートをエスケープ処理
        const escapedAuthor = currentAuthor.replace(/'/g, "\\'"); 
        
        postElement.innerHTML = `
            <div class="post-header">
                <strong>${post.author}</strong>
                <span class="post-date">${dateString}</span>
            </div>
            <p class="post-content">${post.content}</p>
            <div class="post-actions">
                <button 
                    class="like-button ${likeButtonClass}" 
                    onclick="window.toggleLike('${postId}', '${escapedAuthor}')"
                    ${disabledAttr}
                >
                    ${likeButtonText} (${post.likesCount || 0})
                </button>
                <button 
                    class="reply-button" 
                    onclick="window.postReply('${postId}')"
                    ${disabledAttr}
                >
                    返信する
                </button>
            </div>
            <div class="replies-section" id="replies-${postId}">
                </div>
        `;
        
        // ページに追加
        postsDiv.appendChild(postElement);

        // 返信セクションのレンダリングを開始
        const repliesDiv = postElement.querySelector(`#replies-${postId}`);
        renderReplies(postId, repliesDiv);
    });
});
