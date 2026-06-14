import type { Translations } from "./en"

const ja: Translations = {
  common: {
    ok: "OK",
    cancel: "キャンセル",
    back: "戻る",
  },
  errorScreen: {
    title: "問題が発生しました",
    friendlySubtitle:
      "Moneyflyで予期しないエラーが発生しました。続行するにはアプリをリセットしてください。",
    reset: "アプリをリセット",
  },
  emptyStateComponent: {
    generic: {
      heading: "データが見つかりません",
      content: "更新または再読み込みして、もう一度お試しください。",
      button: "もう一度試す",
    },
  },
}

export default ja
