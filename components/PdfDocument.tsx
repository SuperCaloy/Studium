import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { ReviewerData } from "@/lib/types";

// Register fonts: EB Garamond for a classical, academic feel, and Inter for UI-like small caps
Font.register({
  family: "EB Garamond",
  fonts: [
    { src: "https://fonts.gstatic.com/s/ebgaramond/v26/SlGdmQSNjdsmc35JDF1K5E55Y-YDv7Q.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/ebgaramond/v26/SlGdmQSNjdsmc35JDF1K5E55Y-abvrQ.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/ebgaramond/v26/SlGdmQSNjdsmc35JDF1K5E55Y-aBvbQ.ttf", fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/ebgaramond/v26/SlGcmQSNjdsmc35JDF1K5E55cOJcfZ83Cg.ttf", fontWeight: 400, fontStyle: "italic" },
  ],
});

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZhrib2Bg-4.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf", fontWeight: 600 },
  ],
});

// minimax-pdf 'Academic' Design Tokens
const COLORS = {
  bg: "#FAFAFA",
  text: "#1A1A1A",
  muted: "#5A5A5A",
  accent: "#2A5A6B", // Deep teal (Academic / Research)
  accentLight: "#EBF1F3",
  border: "#E2E8F0",
};

const styles = StyleSheet.create({
  page: {
    padding: "50px 60px",
    fontFamily: "EB Garamond",
    backgroundColor: COLORS.bg,
  },
  cover: {
    paddingTop: 80,
    paddingBottom: 40,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.accent,
    marginBottom: 30,
  },
  docType: {
    fontFamily: "Inter",
    fontSize: 9,
    fontWeight: 600,
    color: COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: COLORS.text,
    lineHeight: 1.2,
    marginBottom: 12,
  },
  overview: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 1.6,
    fontStyle: "italic",
    maxWidth: 400,
  },
  section: {
    marginTop: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    paddingLeft: 12,
    marginBottom: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: COLORS.text,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 6,
  },
  text: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 1.7,
    marginBottom: 8,
  },
  bulletList: {
    marginLeft: 6,
    marginBottom: 12,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: {
    width: 12,
    fontSize: 11,
    color: COLORS.accent,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 1.6,
  },
  termBox: {
    marginBottom: 10,
    padding: 12,
    backgroundColor: COLORS.accentLight,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
  },
  termTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.accent,
    marginBottom: 4,
  },
  termDef: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 1.5,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  footerText: {
    fontFamily: "Inter",
    fontSize: 8,
    color: COLORS.muted,
  },
  factBox: {
    flexDirection: "row",
    marginBottom: 6,
  },
  factFormula: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10,
    color: COLORS.accent,
    width: "30%",
    paddingRight: 10,
  },
  factContext: {
    fontSize: 11,
    color: COLORS.text,
    flex: 1,
    lineHeight: 1.4,
  },
});

export const PdfDocument = ({ reviewer }: { reviewer: ReviewerData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* Cover Section */}
      <View style={styles.cover}>
        <Text style={styles.docType}>Study Guide & Reviewer</Text>
        <Text style={styles.title}>{reviewer?.summary?.title}</Text>
        <Text style={styles.overview}>{reviewer?.summary?.overview}</Text>
      </View>

      {/* Key Takeaways */}
      {reviewer?.summary?.keyTakeaways?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
          </View>
          <View style={styles.bulletList}>
            {(reviewer?.summary?.keyTakeaways || []).filter(Boolean).map((fact, i) => (
              <View key={i} style={styles.bulletItem} wrap={false}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{fact}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Facts (if any) */}
      {reviewer?.facts?.length > 0 && (
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Formulas & Constants</Text>
          </View>
          {(reviewer?.facts || []).filter(Boolean).map((fact, i) => (
            <View key={i} style={styles.factBox}>
              <Text style={styles.factFormula}>{fact.formula}</Text>
              <Text style={styles.factContext}>{fact.context}</Text>
            </View>
          ))}
          <View style={styles.divider} />
        </View>
      )}

      {/* Topics */}
      {(reviewer?.topics || []).filter(Boolean).map((topic, i) => (
        <View key={i} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{topic?.title}</Text>
          </View>
          <Text style={styles.text}>{topic?.summary}</Text>
          
          {(topic?.details || []).filter(Boolean).map((detail, j) => (
            <View key={j} wrap={false} style={{ marginTop: 8 }}>
              <Text style={styles.subHeading}>{detail?.heading}</Text>
              <View style={styles.bulletList}>
                {(detail?.points || []).filter(Boolean).map((point, k) => (
                  <View key={k} style={styles.bulletItem}>
                    <Text style={styles.bullet}>—</Text>
                    <Text style={styles.bulletText}>{point}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}

      {/* Terms */}
      {reviewer?.terms?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader} wrap={false}>
            <Text style={styles.sectionTitle}>Glossary</Text>
          </View>
          {(reviewer?.terms || []).filter(Boolean).map((term, i) => (
            <View key={i} style={styles.termBox} wrap={false}>
              <Text style={styles.termTitle}>{term?.term}</Text>
              <Text style={styles.termDef}>{term?.definition}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Studium AI Reviewer</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);
