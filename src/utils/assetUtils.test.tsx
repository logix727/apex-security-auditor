
import { describe, it, expect } from 'vitest';
import { getStatusColor, getStatusBadge, getDetectionBadges } from './assetUtils';
import { render, screen } from '@testing-library/react';
import { Badge } from '../types';

describe('assetUtils', () => {
    describe('getStatusColor', () => {
        it('should return critical for 0', () => {
            expect(getStatusColor(0)).toBe('var(--status-critical)');
        });

        it('should return safe for 2xx', () => {
            expect(getStatusColor(200)).toBe('var(--status-safe)');
            expect(getStatusColor(204)).toBe('var(--status-safe)');
        });

        it('should return blue for 3xx', () => {
            expect(getStatusColor(301)).toBe('#3b82f6');
        });

        it('should return warning for 4xx', () => {
            expect(getStatusColor(404)).toBe('var(--status-warning)');
        });

        it('should return critical for 5xx', () => {
            expect(getStatusColor(500)).toBe('var(--status-critical)');
        });
    });

    describe('getStatusBadge', () => {
        it('should render FAIL for code 0', () => {
            const element = getStatusBadge(0, []);
            render(element);
            expect(screen.getByText('FAIL')).toBeInTheDocument();
        });
        
        it('should have correct text for code 200', () => {
            const element = getStatusBadge(200, []);
            render(element);
            expect(screen.getByText('200')).toBeInTheDocument();
        });

        it('should show skull for code 0', () => {
            const element = getStatusBadge(0, []);
            render(element);
            expect(screen.getByText('💀')).toBeInTheDocument();
            expect(screen.getByText('FAIL')).toBeInTheDocument();
        });
    });

    describe('getDetectionBadges', () => {
        it('should return null for empty findings', () => {
            expect(getDetectionBadges([])).toBeNull();
        });

        it('should render count for categorized badges', () => {
            const findings: Badge[] = [
                { emoji: 'ℹ️', severity: 'Info', short: 'Info', description: 'desc' }, // Info category
                { emoji: '🚨', severity: 'Critical', short: 'Secret', description: 'desc' }, // Secret category
                { emoji: '⚠️', severity: 'Medium', short: 'BOLA', description: 'desc' } // BOLA category
            ] as any;
            const element = getDetectionBadges(findings);
            render(element!);
            
            // Should see 3 badges each with count 1
            const counts = screen.getAllByText('1');
            expect(counts).toHaveLength(3);
        });

        it('should group findings into categories', () => {
            const findings: Badge[] = [
                { short: 'password', description: 'desc' },
                { short: 'key', description: 'desc' },
                { short: 'jwt', description: 'desc' }
            ] as any;
            const element = getDetectionBadges(findings);
            render(element!);
            
            // password and key are Secret category (count 2)
            // jwt is Auth category (count 1)
            expect(screen.getByText('2')).toBeInTheDocument();
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });
});
