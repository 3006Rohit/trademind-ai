
import { User, UserData, Position, Trade, Drawing } from '../types';

// Mock "Database" keys for LocalStorage Mode
const DB_USERS = 'tm_users_db';
const DB_DATA_PREFIX = 'tm_user_data_';

interface StoredUser {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    avatar?: string;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

class AuthService {
    // --- HYBRID AUTHENTICATION ---

    public async checkEmailExists(email: string): Promise<boolean> {
        await delay(500);
        const users = this.getUsersLocal();
        return users.some(u => u.email === email);
    }

    public async login(email: string, password: string): Promise<User> {
        await delay(800);
        const users = this.getUsersLocal();
        const user = users.find(u => u.email === email && u.passwordHash === btoa(password));
        
        if (!user) throw new Error('Invalid email or password');
        
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            token: 'mock-jwt-' + Date.now()
        };
    }

    public async initiateSignup(email: string, password: string, name: string): Promise<void> {
        // Local mode: Do nothing, wait for verify
    }

    public async verifyAndRegister(email: string, password: string, name: string, otp: string): Promise<User> {
        // Local Mode Registration
        const newUser: StoredUser = {
            id: 'u_' + Date.now(),
            email,
            passwordHash: btoa(password),
            name,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
        };

        this.saveUserLocal(newUser);
        
        // Initialize Data
        this.saveUserDataLocal(newUser.id, {
            userId: newUser.id,
            balance: 100000,
            positions: [],
            history: [],
            drawings: []
        });

        return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            avatar: newUser.avatar,
            token: 'mock-jwt-' + Date.now()
        };
    }

    // --- OTP LOGIC ---
    public async generateOTP(email: string): Promise<string> {
        await delay(600);
        const otp = '100';
        // Simulation for frontend demo
        console.log(`[SMTP MOCK] Sending email to ${email} with OTP: ${otp}`);
        alert(`[DEMO EMAIL] Verification Code for ${email}: ${otp}`);
        return otp;
    }

    // --- GOOGLE AUTH MOCK ---
    public async googleLogin(email: string, name: string): Promise<User> {
        await delay(1000);
        const users = this.getUsersLocal();
        let user = users.find(u => u.email === email);

        if (!user) {
            user = {
                id: 'g_' + Date.now(),
                email,
                passwordHash: 'google-oauth-mock',
                name,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
            };
            this.saveUserLocal(user);
            this.saveUserDataLocal(user.id, {
                userId: user.id,
                balance: 100000,
                positions: [],
                history: [],
                drawings: []
            });
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            token: 'mock-jwt-' + Date.now()
        };
    }

    // --- DATA PERSISTENCE ---

    public getUserData(userId: string): UserData {
        // Always try local cache first for speed
        const key = DB_DATA_PREFIX + userId;
        const json = localStorage.getItem(key);
        if (json) return JSON.parse(json);
        
        return {
            userId,
            balance: 100000,
            positions: [],
            history: [],
            drawings: []
        };
    }

    public saveUserData(userId: string, data: UserData): void {
        this.saveUserDataLocal(userId, data);
    }

    // --- LOCAL STORAGE HELPERS ---

    private getUsersLocal(): StoredUser[] {
        const json = localStorage.getItem(DB_USERS);
        return json ? JSON.parse(json) : [];
    }

    private saveUserLocal(user: StoredUser) {
        const users = this.getUsersLocal();
        users.push(user);
        localStorage.setItem(DB_USERS, JSON.stringify(users));
    }

    private saveUserDataLocal(userId: string, data: UserData): void {
        const key = DB_DATA_PREFIX + userId;
        localStorage.setItem(key, JSON.stringify(data));
    }
}

export const authService = new AuthService();
