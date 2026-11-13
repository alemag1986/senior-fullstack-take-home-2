import sqlite3
from typing import List
from fastapi import APIRouter, Depends
from backend.app.api.deps import get_db_conn
from backend.app.core.security import get_authenticated_user_id
from backend.app.models.enums import FeedbackCategory
from backend.app.models.schemas import (
    CategoryStat,
    InsightsResponse,
    MistakePattern,
    TrendPoint,
)

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=InsightsResponse)
def get_user_insights(
    user_id: str = Depends(get_authenticated_user_id),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> InsightsResponse:
    """
    Computes Stage 2 aggregated mistake insights and learning trends:
    - Overall entries, words, and feedback suggestions
    - Decision distribution (accepted, dismissed, pending)
    - Categorical mistake breakdown (grammar, vocabulary, spelling)
    - Most common mistake patterns / rules
    - Chronological activity trends over time
    """
    # 1. Total entries & words
    entry_rows = conn.execute(
        "SELECT content, created_at FROM journal_entries WHERE user_id = ? ORDER BY created_at ASC;",
        (user_id,),
    ).fetchall()

    total_entries = len(entry_rows)
    total_words = 0
    date_entry_counts = {}
    for r in entry_rows:
        text = r["content"] or ""
        total_words += len(text.strip().split()) if text.strip() else 0
        date_key = (r["created_at"] or "")[:10]
        if date_key:
            date_entry_counts[date_key] = date_entry_counts.get(date_key, 0) + 1

    # 2. Total suggestions & categories
    cat_cursor = conn.execute(
        """
        SELECT s.category, COUNT(s.id) as cnt
        FROM suggestions s
        JOIN analyses a ON s.analysis_id = a.id
        JOIN journal_entries e ON a.entry_id = e.id
        WHERE e.user_id = ?
        GROUP BY s.category;
        """,
        (user_id,),
    )
    cat_counts = {row["category"]: row["cnt"] for row in cat_cursor.fetchall()}
    total_suggestions = sum(cat_counts.values())

    category_breakdown: List[CategoryStat] = []
    for cat in FeedbackCategory:
        count = cat_counts.get(cat.value, 0)
        percentage = round((count / total_suggestions * 100), 1) if total_suggestions > 0 else 0.0
        category_breakdown.append(
            CategoryStat(category=cat, count=count, percentage=percentage)
        )

    # 3. Actions / Decisions
    act_cursor = conn.execute(
        """
        SELECT sa.action, COUNT(sa.id) as cnt
        FROM suggestion_actions sa
        JOIN suggestions s ON sa.suggestion_id = s.id
        JOIN analyses a ON s.analysis_id = a.id
        JOIN journal_entries e ON a.entry_id = e.id
        WHERE e.user_id = ?
        GROUP BY sa.action;
        """,
        (user_id,),
    )
    act_counts = {row["action"]: row["cnt"] for row in act_cursor.fetchall()}
    accepted = act_counts.get("accepted", 0)
    dismissed = act_counts.get("dismissed", 0)
    pending = max(0, total_suggestions - (accepted + dismissed))

    # 4. Top Mistakes
    top_cursor = conn.execute(
        """
        SELECT s.rule_code, s.category, s.explanation_title, COUNT(s.id) as cnt
        FROM suggestions s
        JOIN analyses a ON s.analysis_id = a.id
        JOIN journal_entries e ON a.entry_id = e.id
        WHERE e.user_id = ?
        GROUP BY s.rule_code, s.category
        ORDER BY cnt DESC
        LIMIT 5;
        """,
        (user_id,),
    )
    top_mistakes: List[MistakePattern] = []
    for r in top_cursor.fetchall():
        try:
            cat_enum = FeedbackCategory(r["category"])
        except ValueError:
            cat_enum = FeedbackCategory.GRAMMAR_SYNTAX
        top_mistakes.append(
            MistakePattern(
                ruleCode=r["rule_code"],
                category=cat_enum,
                count=r["cnt"],
                sampleExplanation=r["explanation_title"] or r["rule_code"],
            )
        )

    # 5. Chronological trends
    date_mistake_counts = {}
    trend_cursor = conn.execute(
        """
        SELECT SUBSTR(a.created_at, 1, 10) as day, COUNT(s.id) as cnt
        FROM suggestions s
        JOIN analyses a ON s.analysis_id = a.id
        JOIN journal_entries e ON a.entry_id = e.id
        WHERE e.user_id = ?
        GROUP BY day;
        """,
        (user_id,),
    )
    for r in trend_cursor.fetchall():
        day = r["day"]
        if day:
            date_mistake_counts[day] = r["cnt"]

    all_days = sorted(set(list(date_entry_counts.keys()) + list(date_mistake_counts.keys())))
    recent_trends: List[TrendPoint] = [
        TrendPoint(
            date=day,
            entriesCount=date_entry_counts.get(day, 0),
            mistakesCount=date_mistake_counts.get(day, 0),
        )
        for day in all_days[-7:]
    ]

    return InsightsResponse(
        totalEntries=total_entries,
        totalWords=total_words,
        totalSuggestions=total_suggestions,
        acceptedDecisions=accepted,
        dismissedDecisions=dismissed,
        pendingDecisions=pending,
        categoryBreakdown=category_breakdown,
        topMistakes=top_mistakes,
        recentTrends=recent_trends,
    )
