using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StrategyEngine.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSimulationResults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SimulationResults",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    StrategyId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ReportJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NetProfit = table.Column<double>(type: "double precision", nullable: false),
                    SharpeRatio = table.Column<double>(type: "double precision", nullable: false),
                    MaxDrawdown = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SimulationResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SimulationResults_Strategies_StrategyId",
                        column: x => x.StrategyId,
                        principalTable: "Strategies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SimulationResults_StrategyId",
                table: "SimulationResults",
                column: "StrategyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SimulationResults");
        }
    }
}
