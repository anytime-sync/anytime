// @ts-nocheck
/**
 * Tier Cascade Rule Tests
 *
 * Run with: npm test -- src/__tests__/feature-flags.cascade.test.ts
 *
 * Rule: If a lower tier is granted access, all higher tiers automatically get access.
 *   - FREE ON    -> PLUS, PRO, VIP all ON (unless explicitly OFF)
 *   - PLUS ON    -> PRO, VIP all ON (unless explicitly OFF)
 *   - PRO ON     -> VIP ON (unless explicitly OFF)
 *   - VIP ON     -> only VIP has access
 */

import { isPlanEnabledByOverride, type FeatureFlagRow } from "@/lib/feature-flags";

describe("Feature Flags Tier Cascade Rule", () => {
  describe("FREE tier enabled", () => {
    it("should cascade FREE ON to PLUS, PRO, VIP", () => {
      const flag: FeatureFlagRow = {
        feature_id: "test",
        override_plan: null,
        disabled: false,
        note: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        enabled_free: true,
        enabled_plus: null,
        enabled_pro: null,
        enabled_vip: null,
      };

      expect(isPlanEnabledByOverride("free", flag)).toBe(true);
      expect(isPlanEnabledByOverride("plus", flag)).toBe(true);
      expect(isPlanEnabledByOverride("pro", flag)).toBe(true);
      expect(isPlanEnabledByOverride("vip", flag)).toBe(true);
    });

    it("should allow explicit FALSE to override cascade (PLUS OFF despite FREE ON)", () => {
      const flag: FeatureFlagRow = {
        feature_id: "test",
        override_plan: null,
        disabled: false,
        note: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        enabled_free: true,
        enabled_plus: false, // Explicit OFF overrides cascade
        enabled_pro: null,
        enabled_vip: null,
      };

      expect(isPlanEnabledByOverride("free", flag)).toBe(true);
      expect(isPlanEnabledByOverride("plus", flag)).toBe(false);
      expect(isPlanEnabledByOverride("pro", flag)).toBe(true); // Still cascades
      expect(isPlanEnabledByOverride("vip", flag)).toBe(true);
    });
  });

  describe("PLUS tier enabled (FREE off)", () => {
    it("should cascade PLUS ON to PRO, VIP (FREE off)", () => {
      const flag: FeatureFlagRow = {
        feature_id: "test",
        override_plan: null,
        disabled: false,
        note: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        enabled_free: false,
        enabled_plus: true,
        enabled_pro: null,
        enabled_vip: null,
      };

      expect(isPlanEnabledByOverride("free", flag)).toBe(false);
      expect(isPlanEnabledByOverride("plus", flag)).toBe(true);
      expect(isPlanEnabledByOverride("pro", flag)).toBe(true);
      expect(isPlanEnabledByOverride("vip", flag)).toBe(true);
    });
  });

  describe("PRO tier enabled (FREE, PLUS off)", () => {
    it("should cascade PRO ON to VIP", () => {
      const flag: FeatureFlagRow = {
        feature_id: "test",
        override_plan: null,
        disabled: false,
        note: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        enabled_free: false,
        enabled_plus: false,
        enabled_pro: true,
        enabled_vip: null,
      };

      expect(isPlanEnabledByOverride("free", flag)).toBe(false);
      expect(isPlanEnabledByOverride("plus", flag)).toBe(false);
      expect(isPlanEnabledByOverride("pro", flag)).toBe(true);
      expect(isPlanEnabledByOverride("vip", flag)).toBe(true);
    });
  });

  describe("VIP tier only", () => {
    it("should only enable VIP when others are off", () => {
      const flag: FeatureFlagRow = {
        feature_id: "test",
        override_plan: null,
        disabled: false,
        note: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        enabled_free: false,
        enabled_plus: false,
        enabled_pro: false,
        enabled_vip: true,
      };

      expect(isPlanEnabledByOverride("free", flag)).toBe(false);
      expect(isPlanEnabledByOverride("plus", flag)).toBe(false);
      expect(isPlanEnabledByOverride("pro", flag)).toBe(false);
      expect(isPlanEnabledByOverride("vip", flag)).toBe(true);
    });
  });

  describe("All off", () => {
    it("should return false for all tiers", () => {
      const flag: FeatureFlagRow = {
        feature_id: "test",
        override_plan: null,
        disabled: false,
        note: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        enabled_free: false,
        enabled_plus: false,
        enabled_pro: false,
        enabled_vip: false,
      };

      expect(isPlanEnabledByOverride("free", flag)).toBe(false);
      expect(isPlanEnabledByOverride("plus", flag)).toBe(false);
      expect(isPlanEnabledByOverride("pro", flag)).toBe(false);
      expect(isPlanEnabledByOverride("vip", flag)).toBe(false);
    });
  });

  describe("No overrides (all null)", () => {
    it("should return null to fall back to minPlan rule", () => {
      const flag: FeatureFlagRow = {
        feature_id: "test",
        override_plan: null,
        disabled: false,
        note: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        enabled_free: null,
        enabled_plus: null,
        enabled_pro: null,
        enabled_vip: null,
      };

      expect(isPlanEnabledByOverride("free", flag)).toBe(null);
      expect(isPlanEnabledByOverride("plus", flag)).toBe(null);
      expect(isPlanEnabledByOverride("pro", flag)).toBe(null);
      expect(isPlanEnabledByOverride("vip", flag)).toBe(null);
    });
  });

  describe("Real-world example: Daily Edition issue", () => {
    it("should fix VIP morning brief issue when FREE is ON", () => {
      // Before fix: admin set FREE ON, but left VIP as null
      // After fix: VIP should inherit the true value
      const flag: FeatureFlagRow = {
        feature_id: "ai_daily_edition",
        override_plan: null,
        disabled: false,
        note: "Fixed: cascade rule applied",
        updated_at: new Date().toISOString(),
        updated_by: null,
        enabled_free: true,
        enabled_plus: true,
        enabled_pro: null, // Not explicitly set
        enabled_vip: null, // Not explicitly set but should cascade
      };

      expect(isPlanEnabledByOverride("free", flag)).toBe(true);
      expect(isPlanEnabledByOverride("plus", flag)).toBe(true);
      expect(isPlanEnabledByOverride("pro", flag)).toBe(true); // Cascades from FREE
      expect(isPlanEnabledByOverride("vip", flag)).toBe(true); // Cascades from FREE
    });
  });
});
