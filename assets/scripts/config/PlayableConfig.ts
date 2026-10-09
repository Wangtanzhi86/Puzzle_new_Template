/** 商店地址。上线前必须替换掉 XXXX 占位符 —— 打包脚本会卡这一条。 */
export const IOS_STORE_URL = 'https://apps.apple.com/us/app/art-story-jigsaw-puzzle-game/id6757786318';
export const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.zyhw.art.puzzle';

export const IS_PLACEHOLDER = /XXXX/.test(IOS_STORE_URL) || /XXXX/.test(ANDROID_STORE_URL);
