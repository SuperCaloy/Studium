import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { ReviewerData } from "@/lib/types";

// Removed custom font registration. Using reliable default standard fonts.

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
    padding: "30px 40px",
    fontFamily: "Times-Roman",
    backgroundColor: COLORS.bg,
  },
  cover: {
    paddingTop: 30,
    paddingBottom: 20,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.accent,
    marginBottom: 16,
  },
  docType: {
    fontFamily: "Helvetica",
    fontSize: 9,
    fontWeight: 600,
    color: COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: COLORS.text,
    lineHeight: 1.2,
    marginBottom: 8,
  },
  overview: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 1.4,
    fontStyle: "italic",
    maxWidth: "100%",
  },
  section: {
    marginTop: 12,
    marginBottom: 8,
  },
  sectionHeader: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    paddingLeft: 8,
    marginBottom: 8,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.text,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  text: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  bulletList: {
    marginLeft: 6,
    marginBottom: 6,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 4,
  },
  bullet: {
    width: 10,
    fontSize: 10,
    color: COLORS.accent,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  termBox: {
    marginBottom: 4,
    padding: 6,
    backgroundColor: COLORS.accentLight,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
  },
  termTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.accent,
    marginBottom: 2,
  },
  termDef: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  factBox: {
    flexDirection: "row",
    marginBottom: 3,
  },
  factFormula: {
    fontFamily: "Helvetica",
    fontWeight: 600,
    fontSize: 9,
    color: COLORS.accent,
    width: "25%",
    paddingRight: 6,
  },
  factContext: {
    fontSize: 10,
    color: COLORS.text,
    flex: 1,
    lineHeight: 1.3,
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Key Facts & Data</Text>
          </View>
          {(reviewer?.facts || []).filter(Boolean).map((fact, i) => (
            <View key={i} style={styles.factBox} wrap={false}>
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
    </Page>
  </Document>
);
