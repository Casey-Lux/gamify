
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/login" | "/manage" | "/missions" | "/missions/new" | "/profile" | "/statistics" | "/store";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/login": Record<string, never>;
			"/manage": Record<string, never>;
			"/missions": Record<string, never>;
			"/missions/new": Record<string, never>;
			"/profile": Record<string, never>;
			"/statistics": Record<string, never>;
			"/store": Record<string, never>
		};
		Pathname(): "/" | "/login" | "/manage" | "/missions" | "/missions/new" | "/profile" | "/statistics" | "/store";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/_headers" | "/_redirects" | "/favicon.svg" | "/icons/apple-touch-icon.png" | "/icons/icon-192.png" | "/icons/icon-512.png" | "/icons/icon-maskable-192.png" | "/icons/icon-maskable-512.png" | "/manifest.webmanifest" | string & {};
	}
}