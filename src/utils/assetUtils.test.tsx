
import { describe, it, expect } from 'vitest';
import { getStatusColor, getStatusBadge, getDetectionBadges } from './assetUtils';
import { render, screen } from '@testing-library/react';
import React from 'react';
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
        
        // Let's refactor slightly to test the returned element
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

        it('should render highest severity emoji', () => {
            const findings: Badge[] = [
                { emoji: 'ℹ️', severity: 'Info', short: 'Info', description: 'desc' },
                { emoji: '🚨', severity: 'Critical', short: 'Crit', description: 'desc' },
                { emoji: '⚠️', severity: 'Medium', short: 'Med', description: 'desc' }
            ];
            const element = getDetectionBadges(findings);
            render(element!);
            expect(screen.getByText('🚨')).toBeInTheDocument();
            expect(screen.getByText('3')).toBeInTheDocument(); // total count badge
        });
    });
});
