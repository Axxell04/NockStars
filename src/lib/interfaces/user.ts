export interface User {
	id: string;
	username: string;
	admin: boolean;
}

export interface UserToken {
	id: string;
	text: string;
	active: boolean;
}
