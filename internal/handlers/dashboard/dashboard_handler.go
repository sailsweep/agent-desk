package dashboard

import (
	"cs-agent/internal/pkg/httpx"
	"cs-agent/internal/services"

	"cs-agent/internal/pkg/httpx/params"
	"cs-agent/internal/pkg/i18nx"

	"github.com/gin-gonic/gin"
)

func DashboardGetOverview(ctx *gin.Context) {
	rangeValue, _ := params.Get(ctx, "range")
	httpx.WriteJSON(ctx, services.DashboardService.GetOverview(rangeValue, i18nx.Locale(ctx)))
}
